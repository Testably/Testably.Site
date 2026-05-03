using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Nuke.Common;
using Nuke.Common.IO;
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
	///     When true, fetch <c>README.md</c> from the source repo, drop everything before the first
	///     <c>##</c> heading, and substitute the result into any <c>{README}</c> placeholder found in
	///     a <c>00-*</c> file. Lets extension repos keep their public README and their first docs page
	///     in sync without duplicating content.
	/// </param>
	record DocsSource(
		string Organization,
		string Repository,
		string SourcePath,
		string TargetSubDirectory,
		bool InlineReadme = false);

	/// <summary>
	///     The slices that compose the testably.org documentation portal. Order matters:
	///     later sources may overlay files written by earlier ones (e.g. each extension
	///     overwrites the placeholder <c>00-index.md</c> seeded by the bundled
	///     <c>aweXpect/extensions</c> slice).
	/// </summary>
	static readonly DocsSource[] AggregatedSources =
	[
		new("Testably", "Testably.Abstractions", "Docs/pages/docs", "abstractions"),
		new("Testably", "aweXpect",              "Docs/pages",      "awexpect"),
		new("Testably", "aweXpect.Json",         "Docs/pages",      "extensions/aweXpect.Json",       InlineReadme: true),
		new("Testably", "aweXpect.Mockolate",    "Docs/pages",      "extensions/aweXpect.Mockolate",  InlineReadme: true),
		new("Testably", "aweXpect.Reflection",   "Docs/pages",      "extensions/aweXpect.Reflection", InlineReadme: true),
		new("Testably", "aweXpect.Testably",     "Docs/pages",      "extensions/aweXpect.Testably",   InlineReadme: true),
		new("Testably", "aweXpect.Web",          "Docs/pages",      "extensions/aweXpect.Web",        InlineReadme: true),
		new("Testably", "Mockolate",             "Docs/pages",      "mockolate"),
	];

	Target Pages => _ => _
		.Executes(async () =>
		{
			AbsolutePath docsRoot = RootDirectory / "Docs" / "pages" / "docs";
			docsRoot.CreateOrCleanDirectory();

			foreach (DocsSource source in AggregatedSources)
			{
				AbsolutePath targetDirectory = string.IsNullOrEmpty(source.TargetSubDirectory)
					? docsRoot
					: docsRoot / source.TargetSubDirectory;
				targetDirectory.CreateDirectory();
				await DownloadDocsContent(source, targetDirectory);
			}
		});

	async Task DownloadDocsContent(DocsSource source, AbsolutePath baseDirectory)
	{
		Log.Information($"Aggregate {source.Organization}/{source.Repository}/{source.SourcePath} into {baseDirectory}:");

		using HttpClient client = new();
		client.DefaultRequestHeaders.UserAgent.ParseAdd("Testably.Site");
		if (!string.IsNullOrEmpty(GithubToken))
		{
			client.DefaultRequestHeaders.Authorization =
				new AuthenticationHeaderValue("Bearer", GithubToken);
		}

		// README inlining: fetch once, then a stateful transformer substitutes the
		// stripped README content into the first 00-* file containing {README}.
		string readmeContent = source.InlineReadme
			? await FetchReadmeIntro(client, source)
			: string.Empty;

		Func<string, string, string>? transformer = source.InlineReadme
			? (name, content) =>
			{
				if (name.StartsWith("00-", StringComparison.Ordinal) &&
				    content.Contains("{README}", StringComparison.Ordinal))
				{
					string substitution = readmeContent.Replace("Docs/pages/", "./", StringComparison.Ordinal);
					content = content.Replace("{README}", substitution, StringComparison.Ordinal);
					readmeContent = string.Empty; // substitute into the first match only
					Log.Information($"  Inlined README.md into {name}");
				}
				return content;
			}
			: null;

		HttpResponseMessage response = await client.GetAsync(
			$"https://api.github.com/repos/{source.Organization}/{source.Repository}/contents/{source.SourcePath}");

		string responseContent = await response.Content.ReadAsStringAsync();
		if (!response.IsSuccessStatusCode)
		{
			Log.Warning(
				$"Skipping {source.Organization}/{source.Repository}: could not list '{source.SourcePath}' ({(int)response.StatusCode} {response.StatusCode}): {responseContent}");
			return;
		}

		try
		{
			JsonDocument jsonDocument = JsonDocument.Parse(responseContent);
			foreach (JsonElement file in jsonDocument.RootElement.EnumerateArray())
			{
				await DownloadFileOrDirectory(client, source, "/", file, baseDirectory, transformer);
			}
		}
		catch (JsonException e)
		{
			Log.Error($"Could not parse JSON: {e.Message}\n{responseContent}");
		}
	}

	async Task<string> FetchReadmeIntro(HttpClient client, DocsSource source)
	{
		HttpResponseMessage response = await client.GetAsync(
			$"https://api.github.com/repos/{source.Organization}/{source.Repository}/contents/README.md");
		string responseContent = await response.Content.ReadAsStringAsync();
		if (!response.IsSuccessStatusCode)
		{
			Log.Warning($"Could not fetch README.md from {source.Organization}/{source.Repository}: {response.StatusCode}");
			return string.Empty;
		}

		using JsonDocument document = JsonDocument.Parse(responseContent);
		string readme = Base64Decode(document.RootElement.GetProperty("content").GetString()!);
		int indexOfFirstH2 = readme.IndexOf("\n##", StringComparison.Ordinal);
		return indexOfFirstH2 > 0 ? readme.Substring(indexOfFirstH2) : string.Empty;
	}

	async Task DownloadFileOrDirectory(HttpClient client, DocsSource source, string subPath,
		JsonElement fileOrDirectory, AbsolutePath targetDirectory, Func<string, string, string>? transformer = null)
	{
		string name = fileOrDirectory.GetProperty("name").GetString()!;
		// Many sibling repos prefix their landing page with a sort key (e.g. `00-index.md`)
		// so it renders first in autogenerated sidebars. Docusaurus strips the `NN-` prefix
		// from the URL, leaving the slug as `…/index` — which 404s in our setup. Rename to a
		// literal `index.md`/`index.mdx`, which Docusaurus treats as the directory's landing
		// page and serves at the bare directory URL. The numeric prefix carries the upstream's
		// intended sort position, so we re-inject it as `sidebar_position` front-matter to keep
		// the page at the top of the sidebar after the rename strips the prefix.
		Match indexMatch = IndexPrefixRegex.Match(name);
		string targetName = indexMatch.Success ? "index" + indexMatch.Groups[2].Value : name;
		int? sidebarPosition = indexMatch.Success ? int.Parse(indexMatch.Groups[1].Value) : null;
		string filePath = targetDirectory / targetName;
		HttpResponseMessage fileResponse =
			await client.GetAsync(
				$"https://api.github.com/repos/{source.Organization}/{source.Repository}/contents/{source.SourcePath}{subPath}{name}");
		string fileResponseContent = await fileResponse.Content.ReadAsStringAsync();
		using JsonDocument document = JsonDocument.Parse(fileResponseContent);
		if (document.RootElement.ValueKind == JsonValueKind.Array)
		{
			AbsolutePath subDirectory = targetDirectory / name;
			subDirectory.CreateDirectory();
			foreach (JsonElement subFileOrDirectory in document.RootElement.EnumerateArray())
			{
				await DownloadFileOrDirectory(client, source, subPath + name + "/", subFileOrDirectory, subDirectory, transformer);
			}
		}
		else
		{
			string content = Base64Decode(document.RootElement.GetProperty("content").GetString()!);
			if (transformer != null)
			{
				content = transformer(name, content);
			}
			if (sidebarPosition.HasValue)
			{
				content = EnsureSidebarPosition(content, sidebarPosition.Value);
			}
			await File.WriteAllTextAsync(filePath, content);
			Log.Information($"  {name} under {filePath}");
		}
	}

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

	static string Base64Decode(string base64EncodedData)
	{
		byte[] base64EncodedBytes = Convert.FromBase64String(base64EncodedData);
		return Encoding.UTF8.GetString(base64EncodedBytes);
	}
}
