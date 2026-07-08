using System;
using System.Collections.Generic;
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
	///     Fetches the latest Awaiten benchmark snapshot from the long-lived
	///     <c>benchmarks</c> branch of <c>Testably/Awaiten</c> and reduces it to
	///     the shape consumed by the <c>AwaitenBenchmarkResult</c> React component.
	///     Mirrors the <see cref="MockolateBenchmarks" /> target but for the
	///     7-container Awaiten dataset (Awaiten, MsDI, Autofac, Jab, PureDI,
	///     DryIoc, SimpleInjector) and groups the <c>Size</c> variants of the
	///     Build/Resolve scenarios under one scenario key.
	/// </summary>
	Target AwaitenBenchmarks => _ => _
		.Executes(async () =>
		{
			AbsolutePath outputDirectory = RootDirectory / "Docs" / "pages" / "src" / "data" / "awaiten";
			outputDirectory.CreateDirectory();
			AbsolutePath outputPath = outputDirectory / "benchmarks.json";

			Log.Information(
				"Fetching benchmark snapshot from {Repo} branch {Branch}",
				AwaitenBenchmarksRepo, BenchmarksBranch);

			using HttpClient client = new();
			client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
			if (!string.IsNullOrEmpty(GithubToken))
			{
				client.DefaultRequestHeaders.Authorization =
					new AuthenticationHeaderValue("Bearer", GithubToken);
			}

			string raw = await client.GetStringAsync(
				$"https://raw.githubusercontent.com/{AwaitenBenchmarksRepo}/refs/heads/{BenchmarksBranch}/Docs/pages/static/js/{BenchmarksFile}");
			if (!raw.StartsWith(BenchmarksJsPrefix, StringComparison.Ordinal))
			{
				throw new NotSupportedException(
					$"{BenchmarksFile} does not start with '{BenchmarksJsPrefix}' — upstream format changed?");
			}
			string json = raw.Substring(BenchmarksJsPrefix.Length).TrimEnd(';', '\r', '\n', ' ', '\t');

			Dictionary<string, RawBenchmark> rawData =
				JsonSerializer.Deserialize<Dictionary<string, RawBenchmark>>(json, RawJsonOptions)
				?? throw new NotSupportedException($"Could not deserialize {BenchmarksFile}");

			AwaitenSnapshot snapshot = ReduceToAwaitenSnapshot(rawData, BenchmarkHistoryLength);

			string pretty = JsonSerializer.Serialize(snapshot, OutputJsonOptions);
			await File.WriteAllTextAsync(outputPath, pretty + Environment.NewLine);

			Log.Information(
				"Wrote {ScenarioCount} scenarios to {Path} (captured commit {Sha} on {Date})",
				snapshot.Benchmarks.Count, outputPath, snapshot.CapturedAt.ShortSha, snapshot.CapturedAt.Date);
		});

	const string AwaitenBenchmarksRepo = "Testably/Awaiten";

	static readonly string[] AwaitenLibraries =
		["Awaiten", "MsDI", "Autofac", "Jab", "PureDI", "DryIoc", "SimpleInjector",];

	static AwaitenSnapshot ReduceToAwaitenSnapshot(Dictionary<string, RawBenchmark> rawData, int historyLength)
	{
		// All benchmark groups share the same commit list (Awaiten's benchmark CI appends one
		// entry per push to main, in lockstep across every chart). Pick the first non-empty list
		// to source the "captured at" metadata.
		RawCommit? latestCommit = rawData.Values
			.Where(b => b.Commits is {Count: > 0,})
			.Select(b => b.Commits![^1])
			.FirstOrDefault();
		if (latestCommit is null)
		{
			throw new NotSupportedException("Benchmark data has no commits");
		}

		// Group chart keys ("Build (Size=8)", "Resolve (Size=256)", "Realistic") by scenario name.
		// The Size variants become parameters under a single "Build" / "Resolve" scenario; the
		// unparameterised "Realistic" chart keeps an empty parameter key.
		Dictionary<string, AwaitenScenario> scenarios = new();
		foreach ((string chartKey, RawBenchmark benchmark) in rawData.OrderBy(kvp => kvp.Key, StringComparer.Ordinal))
		{
			if (benchmark.Datasets is null) continue;

			(string scenario, string parameter) = SplitChartKey(chartKey);
			Dictionary<string, AwaitenLibrarySample> samples = new();
			foreach (string library in AwaitenLibraries)
			{
				AwaitenLibrarySample? sample = BuildAwaitenSample(benchmark, library, historyLength);
				if (sample is not null)
				{
					samples[library] = sample;
				}
			}

			if (samples.Count == 0) continue;

			if (!scenarios.TryGetValue(scenario, out AwaitenScenario? entry))
			{
				entry = new AwaitenScenario();
				scenarios[scenario] = entry;
			}

			entry.Parameters.Add(parameter);
			entry.Samples[parameter] = samples;
		}

		// The ordinal chart-key sort orders sizes as 256, 64, 8; re-sort each scenario's
		// parameters by their numeric size so the tabs read 8, 64, 256.
		foreach (AwaitenScenario scenario in scenarios.Values)
		{
			scenario.Parameters.Sort((a, b) => ParameterSize(a).CompareTo(ParameterSize(b)));
		}

		string sha = latestCommit.Sha ?? string.Empty;
		string shortSha = sha.Length >= 8 ? sha[..8] : sha;
		string date = ParseShortDate(latestCommit.Date);

		return new AwaitenSnapshot
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
			Benchmarks = scenarios,
		};
	}

	// Extracts the trailing integer of a "Size=N" parameter for natural sorting; an empty or
	// number-less parameter sorts first.
	static int ParameterSize(string parameter)
	{
		int equals = parameter.LastIndexOf('=');
		string digits = equals >= 0 ? parameter[(equals + 1)..] : parameter;
		return int.TryParse(digits, out int value) ? value : -1;
	}

	static AwaitenLibrarySample? BuildAwaitenSample(RawBenchmark benchmark, string library, int historyLength)
	{
		double[]? time = FindData(benchmark.Datasets!, library, "y");
		double[]? memory = FindData(benchmark.Datasets!, library, "y1");
		if (time is not {Length: > 0,}) return null;

		return new AwaitenLibrarySample
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
	}

	// ─── Snapshot shape consumed by AwaitenBenchmarkResult.tsx ───
	sealed class AwaitenSnapshot
	{
		[JsonPropertyName("capturedAt")]  public SnapshotCommit       CapturedAt  { get; init; } = new();
		[JsonPropertyName("environment")] public SnapshotEnvironment? Environment { get; init; }
		[JsonPropertyName("benchmarks")]  public Dictionary<string, AwaitenScenario> Benchmarks { get; init; } = new();
	}

	sealed class AwaitenScenario
	{
		[JsonPropertyName("parameters")] public List<string> Parameters { get; init; } = new();

		[JsonPropertyName("samples")]
		public Dictionary<string, Dictionary<string, AwaitenLibrarySample>> Samples { get; init; } = new();
	}

	sealed class AwaitenLibrarySample
	{
		[JsonPropertyName("timeNs")]      public double         TimeNs      { get; init; }
		[JsonPropertyName("memoryBytes")] public long?          MemoryBytes { get; init; }
		[JsonPropertyName("history")]     public SampleHistory? History     { get; init; }
	}
}
