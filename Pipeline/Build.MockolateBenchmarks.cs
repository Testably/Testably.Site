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
	///     Fetches the latest Mockolate benchmark snapshot from the long-lived
	///     <c>benchmarks</c> branch of <c>Testably/Mockolate</c> and reduces it
	///     to the shape consumed by the <c>MockolateBenchmarkResult</c> React
	///     component. Mirrors the <see cref="Benchmarks" /> target but for the
	///     6-library Mockolate dataset (Mockolate, Moq, NSubstitute, FakeItEasy,
	///     TUnitMocks, Imposter) and groups <c>[Params]</c> variants under the
	///     same scenario key.
	/// </summary>
	Target MockolateBenchmarks => _ => _
		.Executes(async () =>
		{
			AbsolutePath outputDirectory = RootDirectory / "Docs" / "pages" / "src" / "data" / "mockolate";
			outputDirectory.CreateDirectory();
			AbsolutePath outputPath = outputDirectory / "benchmarks.json";

			Log.Information(
				"Fetching benchmark snapshot from {Repo} branch {Branch}",
				MockolateBenchmarksRepo, BenchmarksBranch);

			using HttpClient client = new();
			client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
			if (!string.IsNullOrEmpty(GithubToken))
			{
				client.DefaultRequestHeaders.Authorization =
					new AuthenticationHeaderValue("Bearer", GithubToken);
			}

			string raw = await client.GetStringAsync(
				$"https://raw.githubusercontent.com/{MockolateBenchmarksRepo}/refs/heads/{BenchmarksBranch}/Docs/pages/static/js/{BenchmarksFile}");
			if (!raw.StartsWith(BenchmarksJsPrefix, StringComparison.Ordinal))
			{
				throw new NotSupportedException(
					$"{BenchmarksFile} does not start with '{BenchmarksJsPrefix}' — upstream format changed?");
			}
			string json = raw.Substring(BenchmarksJsPrefix.Length).TrimEnd(';', '\r', '\n', ' ', '\t');

			Dictionary<string, RawBenchmark> rawData =
				JsonSerializer.Deserialize<Dictionary<string, RawBenchmark>>(json, RawJsonOptions)
				?? throw new NotSupportedException($"Could not deserialize {BenchmarksFile}");

			MockolateSnapshot snapshot = ReduceToMockolateSnapshot(rawData, BenchmarkHistoryLength);

			string pretty = JsonSerializer.Serialize(snapshot, OutputJsonOptions);
			await File.WriteAllTextAsync(outputPath, pretty + Environment.NewLine);

			Log.Information(
				"Wrote {ScenarioCount} scenarios to {Path} (captured commit {Sha} on {Date})",
				snapshot.Benchmarks.Count, outputPath, snapshot.CapturedAt.ShortSha, snapshot.CapturedAt.Date);
		});

	const string MockolateBenchmarksRepo = "Testably/Mockolate";

	static readonly string[] MockolateLibraries =
		["Mockolate", "Moq", "NSubstitute", "FakeItEasy", "TUnitMocks", "Imposter",];

	static MockolateSnapshot ReduceToMockolateSnapshot(Dictionary<string, RawBenchmark> rawData, int historyLength)
	{
		// All benchmark groups share the same commit list (the `BenchmarkReport` target in Mockolate
		// appends one new entry per push to main, in lockstep across every chart). Pick the first
		// non-empty list to source the "captured at" metadata.
		RawCommit? latestCommit = rawData.Values
			.Where(b => b.Commits is {Count: > 0,})
			.Select(b => b.Commits![^1])
			.FirstOrDefault();
		if (latestCommit is null)
		{
			throw new NotSupportedException("Benchmark data has no commits");
		}

		// Group chart keys (e.g. "Method (N=1)", "Method (N=10)", "Callback") by scenario name.
		// Scenarios without parameters keep an empty parameter key.
		Dictionary<string, MockolateScenario> scenarios = new();
		foreach ((string chartKey, RawBenchmark benchmark) in rawData.OrderBy(kvp => kvp.Key, StringComparer.Ordinal))
		{
			if (benchmark.Datasets is null) continue;

			(string scenario, string parameter) = SplitChartKey(chartKey);
			Dictionary<string, MockolateLibrarySample> samples = new();
			foreach (string library in MockolateLibraries)
			{
				MockolateLibrarySample? sample = BuildMockolateSample(benchmark, library, historyLength);
				if (sample is not null)
				{
					samples[library] = sample;
				}
			}

			if (samples.Count == 0) continue;

			if (!scenarios.TryGetValue(scenario, out MockolateScenario? entry))
			{
				entry = new MockolateScenario();
				scenarios[scenario] = entry;
			}

			entry.Parameters.Add(parameter);
			entry.Samples[parameter] = samples;
		}

		string sha = latestCommit.Sha ?? string.Empty;
		string shortSha = sha.Length >= 8 ? sha[..8] : sha;
		string date = ParseShortDate(latestCommit.Date);

		return new MockolateSnapshot
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

	static (string Scenario, string Parameter) SplitChartKey(string chartKey)
	{
		int open = chartKey.IndexOf('(');
		if (open <= 0 || !chartKey.EndsWith(')')) return (chartKey, string.Empty);
		string scenario = chartKey[..open].TrimEnd();
		string parameter = chartKey.Substring(open + 1, chartKey.Length - open - 2).Trim();
		return (scenario, parameter);
	}

	static MockolateLibrarySample? BuildMockolateSample(RawBenchmark benchmark, string library, int historyLength)
	{
		double[]? time = FindData(benchmark.Datasets!, library, "y");
		double[]? memory = FindData(benchmark.Datasets!, library, "y1");
		if (time is not {Length: > 0,}) return null;

		return new MockolateLibrarySample
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

	// ─── Snapshot shape consumed by MockolateBenchmarkResult.tsx ───
	sealed class MockolateSnapshot
	{
		[JsonPropertyName("capturedAt")]  public SnapshotCommit       CapturedAt  { get; init; } = new();
		[JsonPropertyName("environment")] public SnapshotEnvironment? Environment { get; init; }
		[JsonPropertyName("benchmarks")]  public Dictionary<string, MockolateScenario> Benchmarks { get; init; } = new();
	}

	sealed class MockolateScenario
	{
		[JsonPropertyName("parameters")] public List<string> Parameters { get; init; } = new();

		[JsonPropertyName("samples")]
		public Dictionary<string, Dictionary<string, MockolateLibrarySample>> Samples { get; init; } = new();
	}

	sealed class MockolateLibrarySample
	{
		[JsonPropertyName("timeNs")]      public double         TimeNs      { get; init; }
		[JsonPropertyName("memoryBytes")] public long?          MemoryBytes { get; init; }
		[JsonPropertyName("history")]     public SampleHistory? History     { get; init; }
	}
}
