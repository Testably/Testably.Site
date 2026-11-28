using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Xml.Linq;
using Fallout.Common;
using Fallout.Common.IO;
using Serilog;

// ReSharper disable AllUnderscoreLocalParameterName

namespace Build;

partial class Build
{
	/// <summary>
	///     Fetches the latest Testably.Abstractions benchmark snapshot from the <c>benchmarks</c> branch of
	///     <c>Testably/Testably.Abstractions</c> and reduces it to the shape consumed by the
	///     <c>AbstractionsBenchmarkResult</c> React component, like the <see cref="MockolateBenchmarks" /> target.
	/// </summary>
	Target AbstractionsBenchmarks => _ => _
		.Executes(async () =>
		{
			AbsolutePath outputPath = RootDirectory / "Docs" / "pages" / "src" / "data" / "abstractions" /
			                          "benchmarks.json";

			using HttpClient client = new();
			client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
			if (!string.IsNullOrEmpty(GithubToken))
			{
				client.DefaultRequestHeaders.Authorization =
					new AuthenticationHeaderValue("Bearer", GithubToken);
			}

			string raw = await client.GetStringAsync(
				$"https://raw.githubusercontent.com/{AbstractionsBenchmarksRepo}/refs/heads/{BenchmarksBranch}/Docs/pages/static/js/{BenchmarksFile}");
			if (!raw.StartsWith(BenchmarksJsPrefix, StringComparison.Ordinal))
			{
				throw new NotSupportedException(
					$"{BenchmarksFile} does not start with '{BenchmarksJsPrefix}', did the upstream format change?");
			}

			string json = raw.Substring(BenchmarksJsPrefix.Length).TrimEnd(';', '\r', '\n', ' ', '\t');
			Dictionary<string, RawBenchmark> rawData =
				JsonSerializer.Deserialize<Dictionary<string, RawBenchmark>>(json, RawJsonOptions)
				?? throw new NotSupportedException($"Could not deserialize {BenchmarksFile}");

			// The branch starts empty and is only filled by the first push to main after the benchmarks were added.
			if (!rawData.Values.Any(b => b.Commits is {Count: > 0,}))
			{
				Log.Warning("Keep {Path}, because the benchmark data has no commits yet.", outputPath);
				return;
			}

			MockolateSnapshot snapshot =
				ReduceToMockolateSnapshot(rawData, AbstractionsLibraries, BenchmarkHistoryLength);

			// The versions of the compared libraries at the measured commit, so that they always match the numbers.
			string props = await client.GetStringAsync(
				$"https://raw.githubusercontent.com/{AbstractionsBenchmarksRepo}/{snapshot.CapturedAt.Sha}/Directory.Packages.props");
			snapshot.Versions = XDocument.Parse(props).Descendants("PackageVersion")
				.Where(p => AbstractionsPackageLibraries.ContainsKey((string?)p.Attribute("Include") ?? ""))
				.ToDictionary(p => AbstractionsPackageLibraries[(string)p.Attribute("Include")!],
					p => (string?)p.Attribute("Version") ?? "");

			await File.WriteAllTextAsync(outputPath,
				JsonSerializer.Serialize(snapshot, OutputJsonOptions) + Environment.NewLine);

			Log.Information(
				"Wrote {ScenarioCount} scenarios to {Path} (captured commit {Sha} on {Date})",
				snapshot.Benchmarks.Count, outputPath, snapshot.CapturedAt.ShortSha, snapshot.CapturedAt.Date);
		});

	const string AbstractionsBenchmarksRepo = "Testably/Testably.Abstractions";

	static readonly string[] AbstractionsLibraries = ["Testably", "SystemIOAbstractions",];

	/// <summary>
	///     The NuGet package of each compared library in <c>Directory.Packages.props</c>, keyed to its library name.
	/// </summary>
	static readonly Dictionary<string, string> AbstractionsPackageLibraries = new()
	{
		["TestableIO.System.IO.Abstractions.TestingHelpers"] = "SystemIOAbstractions",
	};
}
