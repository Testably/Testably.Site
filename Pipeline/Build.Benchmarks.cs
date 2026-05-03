using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Nuke.Common;
using Nuke.Common.IO;
using Serilog;

// ReSharper disable AllUnderscoreLocalParameterName

namespace Build;

partial class Build
{
	/// <summary>
	///     Fetches the latest aweXpect benchmark snapshot from the long-lived
	///     <c>benchmarks</c> branch of <c>Testably/aweXpect</c> and reduces it
	///     to the shape consumed by the <c>BenchmarkResult</c> React component.
	///     Pulled from the same <c>limited-data.js</c> file the legacy benchmarks
	///     page used; the source is kept up-to-date by aweXpect's own CI on every
	///     push to <c>main</c> (see <c>Pipeline/Build.Benchmarks.cs</c> in that
	///     repo).
	/// </summary>
	Target Benchmarks => _ => _
		.Executes(async () =>
		{
			AbsolutePath outputDirectory = RootDirectory / "Docs" / "pages" / "src" / "data" / "awexpect";
			outputDirectory.CreateDirectory();
			AbsolutePath outputPath = outputDirectory / "benchmarks.json";

			Log.Information(
				"Fetching benchmark snapshot from {Repo} branch {Branch}",
				BenchmarksRepo, BenchmarksBranch);

			using HttpClient client = new();
			client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
			if (!string.IsNullOrEmpty(GithubToken))
			{
				client.DefaultRequestHeaders.Authorization =
					new AuthenticationHeaderValue("Bearer", GithubToken);
			}

			string raw = await client.GetStringAsync(
				$"https://raw.githubusercontent.com/{BenchmarksRepo}/refs/heads/{BenchmarksBranch}/Docs/pages/static/js/{BenchmarksFile}");
			if (!raw.StartsWith(BenchmarksJsPrefix, StringComparison.Ordinal))
			{
				throw new NotSupportedException(
					$"{BenchmarksFile} does not start with '{BenchmarksJsPrefix}' — upstream format changed?");
			}
			string json = raw.Substring(BenchmarksJsPrefix.Length).TrimEnd(';', '\r', '\n', ' ', '\t');

			Dictionary<string, RawBenchmark> rawData =
				JsonSerializer.Deserialize<Dictionary<string, RawBenchmark>>(json, RawJsonOptions)
				?? throw new NotSupportedException($"Could not deserialize {BenchmarksFile}");

			Snapshot snapshot = ReduceToSnapshot(rawData, BenchmarkHistoryLength);

			string pretty = JsonSerializer.Serialize(snapshot, OutputJsonOptions);
			await File.WriteAllTextAsync(outputPath, pretty + Environment.NewLine);

			Log.Information(
				"Wrote {BenchmarkCount} benchmarks to {Path} (captured commit {Sha} on {Date})",
				snapshot.Benchmarks.Count, outputPath, snapshot.CapturedAt.ShortSha, snapshot.CapturedAt.Date);
		});

	const string BenchmarksRepo = "Testably/aweXpect";
	const string BenchmarksBranch = "benchmarks";
	const string BenchmarksFile = "limited-data.js";
	const string BenchmarksJsPrefix = "window.BENCHMARK_DATA = ";
	const int BenchmarkHistoryLength = 16;

	static readonly JsonSerializerOptions RawJsonOptions = new()
	{
		PropertyNameCaseInsensitive = true,
	};

	static readonly JsonSerializerOptions OutputJsonOptions = new()
	{
		WriteIndented = true,
		DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
	};

	static Snapshot ReduceToSnapshot(Dictionary<string, RawBenchmark> rawData, int historyLength)
	{
		// All benchmark groups share the same commit list (the `Build.Benchmarks` target in aweXpect
		// appends one new entry per push to main, in lockstep across every group). Pick the first
		// non-empty list to source the "captured at" metadata.
		RawCommit? latestCommit = rawData.Values
			.Where(b => b.Commits is {Count: > 0,})
			.Select(b => b.Commits![^1])
			.FirstOrDefault();
		if (latestCommit is null)
		{
			throw new NotSupportedException("Benchmark data has no commits");
		}

		Dictionary<string, BenchmarkEntry> benchmarks = new();
		foreach ((string name, RawBenchmark benchmark) in rawData.OrderBy(kvp => kvp.Key))
		{
			if (benchmark.Datasets is null) continue;
			BenchmarkEntry? entry = ReduceBenchmark(benchmark, historyLength);
			if (entry is not null)
			{
				benchmarks[name] = entry;
			}
		}

		string sha = latestCommit.Sha ?? string.Empty;
		string shortSha = sha.Length >= 8 ? sha[..8] : sha;
		string date = ParseShortDate(latestCommit.Date);

		return new Snapshot
		{
			CapturedAt = new SnapshotCommit
			{
				Sha = sha,
				ShortSha = shortSha,
				Date = date,
				Message = latestCommit.Message,
			},
			Environment = new SnapshotEnvironment
			{
				Runner = "ubuntu-latest",
				Toolchain = "BenchmarkDotNet MediumRun (in-process)",
			},
			Benchmarks = benchmarks,
		};
	}

	static BenchmarkEntry? ReduceBenchmark(RawBenchmark benchmark, int historyLength)
	{
		double[]? aweTime = FindData(benchmark.Datasets!, "aweXpect", "y");
		double[]? aweMem = FindData(benchmark.Datasets!, "aweXpect", "y1");
		double[]? faTime = FindData(benchmark.Datasets!, "FluentAssertions", "y");
		double[]? faMem = FindData(benchmark.Datasets!, "FluentAssertions", "y1");
		if (aweTime is not {Length: > 0,} || faTime is not {Length: > 0,}) return null;

		return new BenchmarkEntry
		{
			AweXpect = BuildSample(aweTime, aweMem, historyLength),
			FluentAssertions = BuildSample(faTime, faMem, historyLength),
		};
	}

	static Sample BuildSample(double[] time, double[]? memory, int historyLength)
		=> new()
		{
			TimeNs = Round1(time[^1]),
			MemoryBytes = memory is {Length: > 0,} ? (long)Math.Round(memory[^1]) : null,
			History = new SampleHistory
			{
				TimeNs = TakeLast(time, historyLength).Select(Round1).ToArray(),
				MemoryBytes = memory is null
					? Array.Empty<long>()
					: TakeLast(memory, historyLength).Select(v => (long)Math.Round(v)).ToArray(),
			},
		};

	static double[]? FindData(List<RawDataset> datasets, string libraryPrefix, string axisId)
	{
		// Dataset labels follow "<library> time" / "<library> memory"; the y-axis encodes the metric:
		// y = time (ns), y1 = allocated memory (bytes). Match by both to be robust to label drift.
		foreach (RawDataset dataset in datasets)
		{
			if (dataset.Label?.StartsWith(libraryPrefix, StringComparison.OrdinalIgnoreCase) == true &&
			    string.Equals(dataset.YAxisId, axisId, StringComparison.OrdinalIgnoreCase) &&
			    dataset.Data is not null)
			{
				return dataset.Data;
			}
		}
		return null;
	}

	static IEnumerable<T> TakeLast<T>(IReadOnlyList<T> source, int count)
	{
		int start = Math.Max(0, source.Count - count);
		for (int i = start; i < source.Count; i++) yield return source[i];
	}

	static double Round1(double v) => Math.Round(v, 1);

	static string ParseShortDate(string? raw)
	{
		// Upstream stores dates in `git log` format (e.g. "Fri Nov 21 08:09:23 2025 +0100"
		// or "Sat May 2 12:21:34 2026 +0200" with a single-digit day). We only need an
		// ISO-style short date for display. Parse with invariant culture so the English
		// month abbreviation parses on machines whose default culture is non-English.
		if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
		string[] formats =
		[
			"ddd MMM d HH:mm:ss yyyy zzz",
			"ddd MMM dd HH:mm:ss yyyy zzz",
		];
		if (DateTimeOffset.TryParseExact(raw, formats, CultureInfo.InvariantCulture,
			    DateTimeStyles.AssumeUniversal, out DateTimeOffset parsed) ||
		    DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture,
			    DateTimeStyles.AssumeUniversal, out parsed))
		{
			return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
		}
		return raw;
	}

	// ─── Upstream JSON shape (Chart.js-ready) ───
	sealed class RawBenchmark
	{
		[JsonPropertyName("commits")]  public List<RawCommit>?  Commits  { get; init; }
		[JsonPropertyName("datasets")] public List<RawDataset>? Datasets { get; init; }
	}

	sealed class RawCommit
	{
		[JsonPropertyName("sha")]     public string? Sha     { get; init; }
		[JsonPropertyName("date")]    public string? Date    { get; init; }
		[JsonPropertyName("message")] public string? Message { get; init; }
	}

	sealed class RawDataset
	{
		[JsonPropertyName("label")]   public string?   Label   { get; init; }
		[JsonPropertyName("data")]    public double[]? Data    { get; init; }
		[JsonPropertyName("yAxisID")] public string?   YAxisId { get; init; }
	}

	// ─── Snapshot shape consumed by BenchmarkResult.tsx ───
	sealed class Snapshot
	{
		[JsonPropertyName("capturedAt")]  public SnapshotCommit       CapturedAt  { get; init; } = new();
		[JsonPropertyName("environment")] public SnapshotEnvironment? Environment { get; init; }
		[JsonPropertyName("benchmarks")]  public Dictionary<string, BenchmarkEntry> Benchmarks { get; init; } = new();
	}

	sealed class SnapshotCommit
	{
		[JsonPropertyName("sha")]      public string  Sha      { get; init; } = string.Empty;
		[JsonPropertyName("shortSha")] public string  ShortSha { get; init; } = string.Empty;
		[JsonPropertyName("date")]     public string  Date     { get; init; } = string.Empty;
		[JsonPropertyName("message")]  public string? Message  { get; init; }
	}

	sealed class SnapshotEnvironment
	{
		[JsonPropertyName("runner")]    public string? Runner    { get; init; }
		[JsonPropertyName("toolchain")] public string? Toolchain { get; init; }
	}

	sealed class BenchmarkEntry
	{
		[JsonPropertyName("aweXpect")]         public Sample AweXpect         { get; init; } = new();
		[JsonPropertyName("FluentAssertions")] public Sample FluentAssertions { get; init; } = new();
	}

	sealed class Sample
	{
		[JsonPropertyName("timeNs")]      public double         TimeNs      { get; init; }
		[JsonPropertyName("memoryBytes")] public long?          MemoryBytes { get; init; }
		[JsonPropertyName("history")]     public SampleHistory? History     { get; init; }
	}

	sealed class SampleHistory
	{
		[JsonPropertyName("timeNs")]      public double[] TimeNs      { get; init; } = Array.Empty<double>();
		[JsonPropertyName("memoryBytes")] public long[]   MemoryBytes { get; init; } = Array.Empty<long>();
	}
}
