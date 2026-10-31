using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Fallout.Common.IO;
using Serilog;

namespace Build;

partial class Build
{
	/// <summary>
	///     The libraries that get a changelog page, generated from the GitHub releases of their repository.
	/// </summary>
	static readonly (string Repository, string TargetSubDirectory)[] ChangelogSources =
	[
		("Testably.Abstractions", "Abstractions"),
		("aweXpect", "aweXpect"),
		("Mockolate", "Mockolate"),
		("Awaiten", "Awaiten"),
	];

	/// <summary>
	///     The release note categories in page order. Breaking changes of any type come first; other types
	///     (<c>chore</c>, <c>refactor</c>, <c>docs</c>, <c>test</c>, ...) are not user-facing and are left out.
	/// </summary>
	static readonly (string Type, string Category)[] ChangelogCategories =
	[
		("!", "breaking"),
		("feat", "feature"),
		("fix", "fix"),
		("perf", "performance"),
	];

	static readonly Regex ReleaseItemRegex = new(
		@"^\* (?<title>.+?) by @\S+ in (?<url>https://github\.com/\S+/pull/(?<number>\d+))\s*$", RegexOptions.Compiled);

	static readonly Regex ConventionalTitleRegex = new(
		@"^(?<type>[a-zA-Z]+)(\([^)]*\))?(?<breaking>!)?:\s*(?<text>.+)$", RegexOptions.Compiled);

	static readonly JsonSerializerOptions ChangelogJsonOptions = new()
	{
		PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
		WriteIndented = true,
	};

	async Task WriteChangelogs(AbsolutePath docsRoot)
	{
		using HttpClient client = new();
		client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
		if (!string.IsNullOrEmpty(GithubToken))
		{
			client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GithubToken);
		}

		foreach ((string repository, string targetSubDirectory) in ChangelogSources)
		{
			List<ChangelogRelease> releases = await ReadReleases(client, repository);
			AbsolutePath directory = ResolveTargetDirectory(docsRoot, targetSubDirectory);
			await File.WriteAllTextAsync(directory / "changelog.json", JsonSerializer.Serialize(releases, ChangelogJsonOptions));
			await File.WriteAllTextAsync(directory / "99-changelog.mdx", CreateChangelogPage(repository));
			Log.Information($"Wrote the changelog of {repository} with {releases.Count} releases to {directory}");
		}
	}

	/// <summary>
	///     Reads the published releases with at least one user-facing change, newest first.
	/// </summary>
	static async Task<List<ChangelogRelease>> ReadReleases(HttpClient client, string repository)
	{
		List<GithubRelease> releases = [];
		for (int page = 1; ; page++)
		{
			string json = await client.GetStringAsync(
				$"https://api.github.com/repos/Testably/{repository}/releases?per_page=100&page={page}");
			List<GithubRelease> batch = JsonSerializer.Deserialize<List<GithubRelease>>(json) ?? [];
			releases.AddRange(batch.Where(release => !release.Draft));
			if (batch.Count < 100)
			{
				break;
			}
		}

		return releases
			.OrderByDescending(release => release.PublishedAt)
			.Select(release => new ChangelogRelease(
				release.TagName.TrimStart('v'),
				release.PublishedAt.ToString("yyyy-MM-dd"),
				release.Prerelease,
				$"https://github.com/Testably/{repository}/releases/tag/{release.TagName}",
				ReadChangelogItems(release.Body ?? "")))
			.Where(release => release.Items.Count > 0)
			.ToList();
	}

	/// <summary>
	///     Reads the pull requests that GitHub lists in generated release notes, in category order. The
	///     "New contributors" lines and the pull requests of other types don't match and are skipped.
	/// </summary>
	static List<ChangelogItem> ReadChangelogItems(string body)
	{
		List<(string Type, ChangelogItem Item)> items = body.Split('\n')
			.Select(line => ReleaseItemRegex.Match(line.TrimEnd('\r')))
			.Where(item => item.Success)
			.Select(item => (Item: item, Title: ConventionalTitleRegex.Match(item.Groups["title"].Value)))
			.Where(entry => entry.Title.Success)
			.Select(entry => (
				Type: entry.Title.Groups["breaking"].Success ? "!" : entry.Title.Groups["type"].Value.ToLowerInvariant(),
				Item: new ChangelogItem(
					"",
					Capitalize(entry.Title.Groups["text"].Value),
					int.Parse(entry.Item.Groups["number"].Value),
					entry.Item.Groups["url"].Value)))
			.ToList();
		return ChangelogCategories
			.SelectMany(category => items
				.Where(entry => entry.Type == category.Type)
				.Select(entry => entry.Item with {Category = category.Category,}))
			.ToList();
	}

	/// <summary>
	///     The page that renders the <c>changelog.json</c> next to it with the <c>Changelog</c> component.
	/// </summary>
	static string CreateChangelogPage(string repository)
		=> $$"""
		    ---
		    description: The user-facing changes in each release of {{repository}}, generated from the GitHub releases.
		    ---

		    import Changelog from '@site/src/components/Changelog';
		    import releases from './changelog.json';

		    # Changelog

		    The breaking changes, features, bug fixes and performance improvements of each release, generated from the [GitHub releases](https://github.com/Testably/{{repository}}/releases). Dependency updates and internal changes are left out.

		    <Changelog releases={releases} />

		    """;

	static string Capitalize(string text)
		=> text.Length > 0 ? char.ToUpperInvariant(text[0]) + text[1..] : text;

	sealed record ChangelogRelease(string Version, string Date, bool Prerelease, string Url, List<ChangelogItem> Items);

	sealed record ChangelogItem(string Category, string Text, int Number, string Url);

	sealed class GithubRelease
	{
		[JsonPropertyName("tag_name")]     public string          TagName     { get; init; } = "";
		[JsonPropertyName("body")]         public string?         Body        { get; init; }
		[JsonPropertyName("draft")]        public bool            Draft       { get; init; }
		[JsonPropertyName("prerelease")]   public bool            Prerelease  { get; init; }
		[JsonPropertyName("published_at")] public DateTimeOffset  PublishedAt { get; init; }
	}
}
