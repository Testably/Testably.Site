using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
	record DocsSource(string Organization, string Repository, string SourcePath, string TargetSubDirectory);

	/// <summary>
	///     The slices that compose the testably.org documentation portal. One repository can
	///     contribute multiple slices (e.g. aweXpect contributes both its own docs and its extensions).
	/// </summary>
	static readonly DocsSource[] AggregatedSources =
	[
		new("Testably", "Testably.Abstractions", "Docs/pages/docs",              "abstractions"),
		new("Testably", "aweXpect",              "Docs/pages/docs/expectations", "awexpect"),
		new("Testably", "aweXpect",              "Docs/pages/docs/extensions",   "extensions"),
		new("Testably", "Mockolate",             "Docs/pages",                   "mockolate"),
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

		HttpResponseMessage response = await client.GetAsync(
			$"https://api.github.com/repos/{source.Organization}/{source.Repository}/contents/{source.SourcePath}");

		string responseContent = await response.Content.ReadAsStringAsync();
		if (!response.IsSuccessStatusCode)
		{
			throw new InvalidOperationException(
				$"Could not list '{source.SourcePath}' contents of {source.Organization}/{source.Repository}: {responseContent}");
		}

		try
		{
			JsonDocument jsonDocument = JsonDocument.Parse(responseContent);
			foreach (JsonElement file in jsonDocument.RootElement.EnumerateArray())
			{
				await DownloadFileOrDirectory(client, source, "/", file, baseDirectory);
			}
		}
		catch (JsonException e)
		{
			Log.Error($"Could not parse JSON: {e.Message}\n{responseContent}");
		}
	}

	async Task DownloadFileOrDirectory(HttpClient client, DocsSource source, string subPath,
		JsonElement fileOrDirectory, AbsolutePath targetDirectory)
	{
		string name = fileOrDirectory.GetProperty("name").GetString()!;
		string filePath = targetDirectory / name;
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
				await DownloadFileOrDirectory(client, source, subPath + name + "/", subFileOrDirectory, subDirectory);
			}
		}
		else
		{
			string content = Base64Decode(document.RootElement.GetProperty("content").GetString()!);
			await File.WriteAllTextAsync(filePath, content);
			Log.Information($"  {name} under {filePath}");
		}
	}

	static string Base64Decode(string base64EncodedData)
	{
		byte[] base64EncodedBytes = Convert.FromBase64String(base64EncodedData);
		return Encoding.UTF8.GetString(base64EncodedBytes);
	}
}
