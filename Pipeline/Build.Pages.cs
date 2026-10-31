using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Fallout.Common;
using Fallout.Common.IO;
using Fallout.Common.Tools.Git;
using Serilog;

// ReSharper disable AllUnderscoreLocalParameterName

namespace Build;

partial class Build
{
	/// <summary>
	///     A documentation slice contributed by a sibling repository.
	/// </summary>
	/// <param name="Organization">GitHub organization that owns the source repo.</param>
	/// <param name="Repository">Source repository name.</param>
	/// <param name="SourcePath">Path inside the source repo whose contents should be aggregated (e.g. <c>Docs/pages/docs</c>).</param>
	/// <param name="TargetSubDirectory">Sub-directory under this site's <c>Docs/pages/docs/</c> where the slice lands.</param>
	/// <param name="InlineReadme">
	///     When true, read <c>README.md</c> from the source repo, drop everything before the first
	///     <c>##</c> heading, and substitute the result into any <c>{README}</c> placeholder found in
	///     a <c>00-*</c> file. Lets extension repos keep their public README and their first docs page
	///     in sync without duplicating content.
	/// </param>
	/// <param name="ExtraReadmes">
	///     Optional cross-repo README substitutions. Each entry pulls the named foreign repo's
	///     <c>README.md</c>, strips the leading H1 plus any badge block, and substitutes it into the
	///     placeholder of the named file inside this slice. Lets a docs page own its scaffolding while
	///     sourcing its body from a different repo's README.
	/// </param>
	/// <param name="ExcludedFiles">
	///     Optional file paths, relative to <paramref name="SourcePath"/> and matched exactly
	///     (case-sensitive, <c>/</c>-separated), that are not aggregated. Lets the site drop an
	///     upstream page that another slice supersedes without waiting for the upstream repo to
	///     remove it.
	/// </param>
	/// <param name="CleanTarget">
	///     When false, the target directory is not cleaned before the slice is written. Lets a slice
	///     nested in another slice's target add its files without deleting the files the parent slice
	///     wrote there (e.g. <c>aweXpect/10-migration/03-from-awexpect-2.md</c>).
	/// </param>
	record DocsSource(
		string Organization,
		string Repository,
		string SourcePath,
		string TargetSubDirectory,
		bool InlineReadme = false,
		ReadmeSubstitution[]? ExtraReadmes = null,
		string[]? ExcludedFiles = null,
		bool CleanTarget = true);

	/// <summary>
	///     A cross-repo README substitution. Reads <c>README.md</c> from <paramref name="Organization"/>/<paramref name="Repository"/>,
	///     strips its leading H1 and any consecutive badge lines, and replaces <paramref name="Placeholder"/>
	///     in the docs file named <paramref name="TargetFileName"/>.
	/// </summary>
	record ReadmeSubstitution(
		string Organization,
		string Repository,
		string TargetFileName,
		string Placeholder = "{README}");

	/// <summary>
	///     The slices that compose the testably.org documentation portal. Order matters:
	///     later sources may overlay files written by earlier ones (e.g. each extension
	///     overwrites the placeholder <c>00-index.md</c> seeded by the bundled
	///     <c>aweXpect/Extensions</c> slice), and a slice whose target is nested inside another
	///     slice's target must come after it, because each target directory is cleaned right
	///     before its slice is written (unless the slice sets <see cref="DocsSource.CleanTarget"/>
	///     to false).
	/// </summary>
	static readonly DocsSource[] AggregatedSources =
	[
		new("Testably", "Testably.Abstractions",           "Docs/pages/docs", "Abstractions"),
		new("Testably", "Testably.Abstractions.Migration", "Docs/pages",      "Abstractions/migration-from-testableio/Migration",
			InlineReadme: true),
		new("Testably", "aweXpect",                        "Docs/pages",      "aweXpect",
			ExcludedFiles: ["10-migration.md"]),
		new("Testably", "aweXpect.Migration",              "Docs/pages",      "aweXpect/10-migration",
			InlineReadme: true, CleanTarget: false),
		new("Testably", "aweXpect",              "Docs/extensions/aweXpect.Json",       "aweXpect/07-extensions/aweXpect.Json"),
		new("Testably", "aweXpect.Logging",      "Docs/pages",      "aweXpect/07-extensions/aweXpect.Logging",    InlineReadme: true),
		new("Testably", "aweXpect.Mockolate",    "Docs/pages",      "aweXpect/07-extensions/aweXpect.Mockolate",  InlineReadme: true),
		new("Testably", "aweXpect",              "Docs/extensions/aweXpect.Reflection", "aweXpect/07-extensions/aweXpect.Reflection"),
		new("Testably", "aweXpect",              "Docs/extensions/aweXpect.Snapshots",  "aweXpect/07-extensions/aweXpect.Snapshots"),
		new("Testably", "aweXpect.Testably",     "Docs/pages",      "aweXpect/07-extensions/aweXpect.Testably",   InlineReadme: true),
		new("Testably", "aweXpect",              "Docs/extensions/aweXpect.Web",        "aweXpect/07-extensions/aweXpect.Web"),
		new("Testably", "aweXpect",              "Docs/extensions/aweXpect.Xml",        "aweXpect/07-extensions/aweXpect.Xml"),
		new("Testably", "aweXpect.Chronology",   "Docs/pages",      "aweXpect/07-extensions/aweXpect.Chronology", InlineReadme: true),
		new("Testably", "Mockolate",             "Docs/pages",      "Mockolate",
			ExtraReadmes:
			[
				new("Testably", "Mockolate.Migration", "11-migration.md"),
			]),
		new("Testably", "Awaiten",               "Docs/pages",      "Awaiten"),
	];

	Target Pages => _ => _
		.DependsOn(Benchmarks)
		.DependsOn(MockolateBenchmarks)
		.DependsOn(AwaitenBenchmarks)
		.Executes(() =>
		{
			AbsolutePath docsRoot = RootDirectory / "Docs" / "pages" / "docs";
			docsRoot.CreateDirectory();
			AbsolutePath clonesRoot = TemporaryDirectory / "docs-sources";
			clonesRoot.CreateOrCleanDirectory();

			// Clean each target subdirectory rather than the whole docsRoot so that
			// site-owned overlays committed under docs/ survive the build.
			foreach (DocsSource source in AggregatedSources)
			{
				AbsolutePath targetDirectory = string.IsNullOrEmpty(source.TargetSubDirectory)
					? docsRoot
					: docsRoot / source.TargetSubDirectory;
				if (source.CleanTarget)
				{
					targetDirectory.CreateOrCleanDirectory();
				}
				else
				{
					targetDirectory.CreateDirectory();
				}

				CopyDocsContent(source, clonesRoot, targetDirectory);
			}
		});

	/// <summary>
	///     Shallow-clones the repository's default branch into <paramref name="clonesRoot"/>, once per run.
	///     Cloning instead of crawling the GitHub REST API file by file keeps a run from exhausting the
	///     API rate limit, which surfaced as spurious 404s when several runs were dispatched in a burst.
	/// </summary>
	static AbsolutePath CloneRepository(AbsolutePath clonesRoot, string organization, string repository)
	{
		AbsolutePath directory = clonesRoot / organization / repository;
		if (!directory.DirectoryExists())
		{
			// Keeps the committed line endings and checks out deeply nested test files on Windows, too.
			GitTasks.Git($"clone --quiet --depth 1 -c core.autocrlf=false -c core.longpaths=true https://github.com/{organization}/{repository}.git {directory}");
		}
		return directory;
	}

	void CopyDocsContent(DocsSource source, AbsolutePath clonesRoot, AbsolutePath baseDirectory)
	{
		Log.Information($"Aggregate {source.Organization}/{source.Repository}/{source.SourcePath} into {baseDirectory}:");

		AbsolutePath sourceDirectory = CloneRepository(clonesRoot, source.Organization, source.Repository) / source.SourcePath;
		if (!sourceDirectory.DirectoryExists())
		{
			throw new Exception(
				$"'{source.SourcePath}' does not exist in {source.Organization}/{source.Repository}; the aggregated source no longer exists at the configured path.");
		}

		// README inlining: read once, then a stateful transformer substitutes the
		// stripped README content into the first 00-* file containing {README}.
		string readmeContent = source.InlineReadme
			? ReadReadmeIntro(ReadReadme(clonesRoot, source.Organization, source.Repository))
			: string.Empty;

		// Cross-repo README substitutions: each entry's README is read once, then
		// substituted into the named target file. Stored as a mutable list so the
		// transformer can clear an entry after it fires (substitute-once semantics).
		List<(ReadmeSubstitution Config, string Body)> extraReadmes = new();
		if (source.ExtraReadmes != null)
		{
			foreach (ReadmeSubstitution sub in source.ExtraReadmes)
			{
				string body = StripReadmeFront(ReadReadme(clonesRoot, sub.Organization, sub.Repository));
				extraReadmes.Add((sub, body));
			}
		}

		Func<string, string, string>? transformer = (source.InlineReadme || extraReadmes.Count > 0)
			? (name, content) =>
			{
				if (source.InlineReadme &&
				    name.StartsWith("00-", StringComparison.Ordinal) &&
				    content.Contains("{README}", StringComparison.Ordinal))
				{
					string substitution = readmeContent.Replace("Docs/pages/", "./", StringComparison.Ordinal);
					content = content.Replace("{README}", substitution, StringComparison.Ordinal);
					readmeContent = string.Empty; // substitute into the first match only
					Log.Information($"  Inlined README.md into {name}");
				}
				for (int i = 0; i < extraReadmes.Count; i++)
				{
					(ReadmeSubstitution cfg, string body) = extraReadmes[i];
					if (string.IsNullOrEmpty(body))
					{
						continue;
					}
					if (string.Equals(name, cfg.TargetFileName, StringComparison.Ordinal) &&
					    content.Contains(cfg.Placeholder, StringComparison.Ordinal))
					{
						content = content.Replace(cfg.Placeholder, body, StringComparison.Ordinal);
						extraReadmes[i] = (cfg, string.Empty); // substitute once
						Log.Information($"  Inlined {cfg.Organization}/{cfg.Repository} README.md into {name}");
					}
				}
				return content;
			}
			: null;

		CopyDirectory(source, sourceDirectory, "", baseDirectory, transformer);
	}

	static string ReadReadme(AbsolutePath clonesRoot, string organization, string repository)
	{
		AbsolutePath readme = CloneRepository(clonesRoot, organization, repository) / "README.md";
		if (!readme.FileExists())
		{
			Log.Warning($"No README.md in {organization}/{repository}.");
			return string.Empty;
		}

		return ReadDocsFile(readme);
	}

	/// <summary>
	///     Drops everything before the first <c>##</c> heading. On the site, the README's pointer to the full
	///     documentation would link to the page itself, so it is removed and links to the site become site-relative.
	/// </summary>
	static string ReadReadmeIntro(string readme)
	{
		int indexOfFirstH2 = readme.IndexOf("\n##", StringComparison.Ordinal);
		if (indexOfFirstH2 <= 0)
		{
			return string.Empty;
		}

		string content = FullDocumentationSentenceRegex.Replace(readme.Substring(indexOfFirstH2), string.Empty);
		return content.Replace("https://docs.testably.org/", "/", StringComparison.Ordinal);
	}

	static readonly Regex FullDocumentationSentenceRegex = new(
		@"The full documentation is available at\s+\[docs\.testably\.org\]\([^)]*\):\s*",
		RegexOptions.Compiled);

	/// <summary>
	///     Drops the leading H1 line, any consecutive badge lines that follow, and the resulting
	///     leading blank lines. Leaves the rest of the README intact.
	/// </summary>
	static string StripReadmeFront(string readme)
	{
		string[] lines = readme.Split('\n');
		int i = 0;
		while (i < lines.Length && string.IsNullOrWhiteSpace(lines[i]))
		{
			i++;
		}
		if (i < lines.Length && lines[i].TrimStart().StartsWith("# ", StringComparison.Ordinal))
		{
			i++;
		}
		while (i < lines.Length && string.IsNullOrWhiteSpace(lines[i]))
		{
			i++;
		}
		while (i < lines.Length && lines[i].TrimStart().StartsWith("[!", StringComparison.Ordinal))
		{
			i++;
		}
		while (i < lines.Length && string.IsNullOrWhiteSpace(lines[i]))
		{
			i++;
		}
		return string.Join('\n', lines, i, lines.Length - i);
	}

	void CopyDirectory(DocsSource source, AbsolutePath sourceDirectory, string relativeDirectory,
		AbsolutePath targetDirectory, Func<string, string, string>? transformer)
	{
		// Git tree order (a directory sorts as if its name ended in `/`), as the GitHub API used to
		// list it, because the substitute-once README semantics depend on which file comes first.
		foreach (string entry in Directory.EnumerateFileSystemEntries(sourceDirectory)
			         .OrderBy(e => Directory.Exists(e) ? Path.GetFileName(e) + "/" : Path.GetFileName(e), StringComparer.Ordinal))
		{
			string name = Path.GetFileName(entry);
			string relativePath = relativeDirectory + name;
			if (Directory.Exists(entry))
			{
				AbsolutePath subDirectory = targetDirectory / name;
				subDirectory.CreateDirectory();
				CopyDirectory(source, entry, relativePath + "/", subDirectory, transformer);
				continue;
			}
			if (source.ExcludedFiles != null &&
			    Array.IndexOf(source.ExcludedFiles, relativePath) >= 0)
			{
				Log.Information($"  Skipped excluded {relativePath}");
				continue;
			}
			// Many sibling repos prefix their landing page with a sort key (e.g. `00-index.md`)
			// so it renders first in autogenerated sidebars. Docusaurus strips the `NN-` prefix
			// from the URL, leaving the slug as `…/index` — which 404s in our setup. Rename to a
			// literal `index.md`/`index.mdx`, which Docusaurus treats as the directory's landing
			// page and serves at the bare directory URL. The numeric prefix carries the upstream's
			// intended sort position, so we re-inject it as `sidebar_position` front-matter to keep
			// the page at the top of the sidebar after the rename strips the prefix.
			Match indexMatch = IndexPrefixRegex.Match(name);
			string targetName = indexMatch.Success ? "index" + indexMatch.Groups[2].Value : name;
			string filePath = targetDirectory / targetName;
			string content = ReadDocsFile(entry);
			if (transformer != null)
			{
				content = transformer(name, content);
			}
			if (indexMatch.Success)
			{
				content = EnsureSidebarPosition(content, int.Parse(indexMatch.Groups[1].Value));
			}
			File.WriteAllText(filePath, content);
			Log.Information($"  {name} under {filePath}");
		}
	}

	/// <summary>
	///     Reads a file as UTF-8 and drops a leading BOM (U+FEFF), which would stop Docusaurus from
	///     parsing the first markdown heading and break <see cref="StripReadmeFront"/>'s H1 detection.
	/// </summary>
	static string ReadDocsFile(string path)
		=> File.ReadAllText(path, Encoding.UTF8).TrimStart('﻿');

	static readonly Regex IndexPrefixRegex = new(@"^(\d+)-index(\.mdx?)$", RegexOptions.Compiled);

	static readonly Regex ExistingSidebarPositionRegex =
		new(@"^sidebar_position\s*:", RegexOptions.Compiled | RegexOptions.Multiline);

	/// <summary>
	///     Adds a <c>sidebar_position</c> field to the file's YAML front matter, preserving any
	///     value the upstream author already set. If the file has no front matter, a fresh block
	///     is prepended.
	/// </summary>
	static string EnsureSidebarPosition(string content, int position)
	{
		if (content.StartsWith("---\n", StringComparison.Ordinal) ||
		    content.StartsWith("---\r\n", StringComparison.Ordinal))
		{
			int frontMatterStart = content.IndexOf('\n') + 1;
			int frontMatterEnd = content.IndexOf("\n---", frontMatterStart, StringComparison.Ordinal);
			if (frontMatterEnd > 0)
			{
				string frontMatter = content.Substring(frontMatterStart, frontMatterEnd - frontMatterStart);
				if (ExistingSidebarPositionRegex.IsMatch(frontMatter))
				{
					return content;
				}
				return content.Insert(frontMatterEnd, $"\nsidebar_position: {position}");
			}
		}
		return $"---\nsidebar_position: {position}\n---\n\n{content}";
	}
}
