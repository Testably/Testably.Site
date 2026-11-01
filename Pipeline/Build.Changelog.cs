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
	///     A library that gets a changelog page, generated from the GitHub releases of its repository.
	/// </summary>
	/// <param name="Repository">The repository whose releases make up the main changelog.</param>
	/// <param name="TargetSubDirectory">The library's directory under <c>Docs/pages/docs/</c>.</param>
	/// <param name="Packages">
	///     The repositories of the extension and migration packages, in sidebar order. Each one gets a subpage of the
	///     main changelog.
	/// </param>
	/// <param name="MergedPackages">
	///     The repositories of packages that are released together with the library from the given major version on.
	///     Their earlier releases get a subpage that is hidden from the sidebar and linked from that major version.
	/// </param>
	sealed record ChangelogSource(
		string Repository,
		string TargetSubDirectory,
		string[]? Packages = null,
		(int Major, string Repository)[]? MergedPackages = null);

	static readonly ChangelogSource[] ChangelogSources =
	[
		new("Testably.Abstractions", "Abstractions",
			Packages: ["Testably.Abstractions.Migration"]),
		new("aweXpect", "aweXpect",
			Packages: ["aweXpect.Chronology", "aweXpect.Logging", "aweXpect.Mockolate", "aweXpect.Testably", "aweXpect.Migration"],
			MergedPackages:
			[
				(4, "aweXpect.Json"), (4, "aweXpect.Reflection"), (4, "aweXpect.Snapshots"), (4, "aweXpect.Web"),
				(4, "aweXpect.Xml"),
			]),
		new("Mockolate", "Mockolate",
			Packages: ["Mockolate.Migration"]),
		new("Awaiten", "Awaiten"),
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

	static readonly Regex MigrationGuideRegex = new(@"^migration-to-v(?<major>\d+)(?<extension>\.mdx?)$", RegexOptions.Compiled);

	async Task WriteChangelogs(AbsolutePath docsRoot, AbsolutePath clonesRoot)
	{
		using HttpClient client = new();
		client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
		if (!string.IsNullOrEmpty(GithubToken))
		{
			client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GithubToken);
		}

		foreach (ChangelogSource source in ChangelogSources)
		{
			AbsolutePath directory = ResolveTargetDirectory(docsRoot, source.TargetSubDirectory);
			List<ChangelogRelease> releases = await ReadReleases(client, source.Repository);
			List<(int Major, string File)> guides = ReadMigrationGuides(clonesRoot, source.Repository);
			string[] packages = source.Packages ?? [];
			(int Major, string Repository)[] mergedPackages = source.MergedPackages ?? [];
			if (packages.Length == 0 && mergedPackages.Length == 0 && guides.Count == 0)
			{
				await WriteChangelog(directory, "99-changelog", new ChangelogData([], [], releases),
					CreateChangelogPage(source.Repository, "99-changelog", []));
				continue;
			}

			// The packages and upgrade guides turn the changelog into a sidebar category whose landing page is the library's changelog.
			directory /= "99-changelog";
			directory.CreateOrCleanDirectory();
			await File.WriteAllTextAsync(directory / "_category_.json", "{\"label\": \"Changelog\"}\n");
			for (int index = 0; index < packages.Length; index++)
			{
				List<ChangelogMigrationGuide> packageGuides = WriteMigrationGuides(directory, source.TargetSubDirectory,
					$"{packages[index]}.", ReadMigrationGuides(clonesRoot, packages[index]));
				await WriteChangelog(directory, packages[index], new ChangelogData(packageGuides, [], await ReadReleases(client, packages[index])),
					CreatePackageChangelogPage(packages[index], $"sidebar_position: {index + 1}", ""));
			}

			List<ChangelogMergedPackage> merged = [];
			foreach ((int major, string repository) in mergedPackages)
			{
				List<ChangelogRelease> packageReleases = await ReadReleases(client, repository);
				await WriteChangelog(directory, repository, new ChangelogData([], [], packageReleases),
					CreatePackageChangelogPage(repository,
						$"sidebar_hidden: true\ndisplayed_sidebar: {SidebarId(source.TargetSubDirectory)}",
						$"\nSince {source.Repository} {major}.0, {repository} is released together with {source.Repository}, and its changes are part of the [{source.Repository} changelog](./index.mdx).\n"));
				merged.Add(new ChangelogMergedPackage(major, repository, $"/{source.TargetSubDirectory}/changelog/{repository}",
					packageReleases.FirstOrDefault()?.Version));
			}

			await WriteChangelog(directory, "index", new ChangelogData(WriteMigrationGuides(directory, source.TargetSubDirectory, "", guides), merged, releases),
				CreateChangelogPage(source.Repository, "index", packages));
		}
	}

	static string SidebarId(string library)
		=> $"{library.ToLowerInvariant()}Sidebar";

	static async Task WriteChangelog(AbsolutePath directory, string name, ChangelogData changelog, string page)
	{
		await File.WriteAllTextAsync(directory / $"{name}.changelog.json", JsonSerializer.Serialize(changelog, ChangelogJsonOptions));
		await File.WriteAllTextAsync(directory / $"{name}.mdx", page);
		Log.Information($"Wrote the changelog {name} with {changelog.Releases.Count} releases to {directory}");
	}

	/// <summary>
	///     Reads the upgrade guides of the repository: the files <c>migration-to-v&lt;major&gt;.md</c> or <c>.mdx</c> in
	///     its <c>Docs/changelogs</c> folder. Any other file there fails the build, so that a misnamed guide is not
	///     silently left out.
	/// </summary>
	static List<(int Major, string File)> ReadMigrationGuides(AbsolutePath clonesRoot, string repository)
	{
		AbsolutePath directory = CloneRepository(clonesRoot, "Testably", repository) / "Docs" / "changelogs";
		if (!directory.DirectoryExists())
		{
			return [];
		}

		List<(int Major, string File)> guides = [];
		foreach (string entry in Directory.EnumerateFileSystemEntries(directory).OrderBy(entry => entry, StringComparer.Ordinal))
		{
			Match match = MigrationGuideRegex.Match(Path.GetFileName(entry));
			if (!match.Success || Directory.Exists(entry))
			{
				throw new Exception(
					$"'{Path.GetFileName(entry)}' in {repository}/Docs/changelogs is not an upgrade guide named 'migration-to-v<major>.md' or '.mdx'.");
			}

			int major = int.Parse(match.Groups["major"].Value);
			if (guides.Any(guide => guide.Major == major))
			{
				throw new Exception($"{repository}/Docs/changelogs contains more than one upgrade guide to v{major}.");
			}

			guides.Add((major, entry));
		}

		return guides;
	}

	/// <summary>
	///     Writes the upgrade guides next to the changelog, hidden from the sidebar (see <c>sidebarItemsGenerator</c> in
	///     <c>docusaurus.config.ts</c>) while they keep showing the library's sidebar, and returns their links.
	/// </summary>
	static List<ChangelogMigrationGuide> WriteMigrationGuides(AbsolutePath directory, string library, string prefix,
		List<(int Major, string File)> guides)
	{
		List<ChangelogMigrationGuide> links = [];
		foreach ((int major, string file) in guides)
		{
			string content = ReadDocsFile(file);
			if (!content.StartsWith("---\n", StringComparison.Ordinal) && !content.StartsWith("---\r\n", StringComparison.Ordinal))
			{
				content = $"---\n---\n\n{content}";
			}
			int frontMatterEnd = content.IndexOf("\n---", 3, StringComparison.Ordinal);
			string name = $"{prefix}migration-to-v{major}";
			File.WriteAllText(directory / (name + Path.GetExtension(file)), content.Insert(frontMatterEnd,
				$"\nsidebar_hidden: true\ndisplayed_sidebar: {SidebarId(library)}"));
			Log.Information($"Wrote the upgrade guide to v{major} under {directory / name}");
			links.Add(new ChangelogMigrationGuide(major, $"/{library}/changelog/{name}"));
		}

		return links;
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
				CountCommits(release.Body ?? ""),
				ReadChangelogItems(release.Body ?? "")))
			.Where(release => release.Items.Count > 0)
			.ToList();
	}

	/// <summary>
	///     Counts all pull requests in the generated release notes, including the ones that are not user-facing.
	///     They are squash-merged, so this is the number of commits in the release.
	/// </summary>
	static int CountCommits(string body)
		=> body.Split('\n').Count(line => ReleaseItemRegex.IsMatch(line.TrimEnd('\r')));

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
	///     The page that renders the <c>&lt;name&gt;.changelog.json</c> next to it with the <c>Changelog</c> component
	///     and links the changelogs of the packages.
	/// </summary>
	static string CreateChangelogPage(string repository, string name, string[] packages)
	{
		string packageLinks = packages.Length == 0
			? ""
			: $"\nThe packages have their own changelogs: {string.Join(", ", packages.Select(package => $"[{package}](./{package}.mdx)"))}.\n";
		return $$"""
		         ---
		         description: The user-facing changes in each release of {{repository}}, generated from the GitHub releases.
		         ---

		         import Changelog from '@site/src/components/Changelog';
		         import changelog from './{{name}}.changelog.json';

		         # Changelog

		         The breaking changes, features, bug fixes and performance improvements of each release, generated from the [GitHub releases](https://github.com/Testably/{{repository}}/releases). Dependency updates and internal changes are left out.
		         {{packageLinks}}
		         <Changelog changelog={changelog} />

		         """;
	}

	static string CreatePackageChangelogPage(string repository, string sidebarFrontMatter, string note)
		=> $$"""
		    ---
		    description: The user-facing changes in each release of {{repository}}, generated from the GitHub releases.
		    sidebar_label: {{repository}}
		    {{sidebarFrontMatter}}
		    ---

		    import Changelog from '@site/src/components/Changelog';
		    import changelog from './{{repository}}.changelog.json';

		    # {{repository}}

		    The breaking changes, features, bug fixes and performance improvements of each release of {{repository}}, generated from the [GitHub releases](https://github.com/Testably/{{repository}}/releases). Dependency updates and internal changes are left out.
		    {{note}}
		    <Changelog changelog={changelog} />

		    """;

	static string Capitalize(string text)
		=> text.Length > 0 ? char.ToUpperInvariant(text[0]) + text[1..] : text;

	sealed record ChangelogData(
		List<ChangelogMigrationGuide> MigrationGuides,
		List<ChangelogMergedPackage> MergedPackages,
		List<ChangelogRelease> Releases);

	sealed record ChangelogMigrationGuide(int Major, string Url);

	sealed record ChangelogMergedPackage(int Major, string Name, string Url, string? LastVersion);

	sealed record ChangelogRelease(string Version, string Date, bool Prerelease, string Url, int Commits, List<ChangelogItem> Items);

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
