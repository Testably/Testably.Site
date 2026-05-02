using System;
using System.Collections.Generic;
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
	const string GithubOrganization = "Testably";
	const string SourceDocsPath = "Docs/pages/docs";

	/// <summary>
	///     Source repositories whose <c>Docs/pages/docs/</c> content is aggregated into this site.
	///     The key is the GitHub repository name, the value the subdirectory under
	///     <c>Docs/pages/docs/</c> in this repo (empty string places content at the root of <c>docs/</c>).
	/// </summary>
	static readonly Dictionary<string, string> AggregatedProjects = new()
	{
		{ "Testably.Abstractions", "" },
	};

	Target Pages => _ => _
		.Executes(async () =>
		{
			AbsolutePath docsRoot = RootDirectory / "Docs" / "pages" / "docs";
			docsRoot.CreateOrCleanDirectory();

			foreach ((string project, string subDirectory) in AggregatedProjects)
			{
				AbsolutePath targetDirectory = string.IsNullOrEmpty(subDirectory)
					? docsRoot
					: docsRoot / subDirectory;
				targetDirectory.CreateDirectory();
				await DownloadDocsContent(project, targetDirectory);
			}
		});

	async Task DownloadDocsContent(string projectName, AbsolutePath baseDirectory)
	{
		Log.Information($"Aggregate documentation from {projectName} into {baseDirectory}:");

		using HttpClient client = new();
		client.DefaultRequestHeaders.UserAgent.ParseAdd(GithubOrganization);
		if (!string.IsNullOrEmpty(GithubToken))
		{
			client.DefaultRequestHeaders.Authorization =
				new AuthenticationHeaderValue("Bearer", GithubToken);
		}

		HttpResponseMessage response = await client.GetAsync(
			$"https://api.github.com/repos/{GithubOrganization}/{projectName}/contents/{SourceDocsPath}");

		string responseContent = await response.Content.ReadAsStringAsync();
		if (!response.IsSuccessStatusCode)
		{
			throw new InvalidOperationException(
				$"Could not list '{SourceDocsPath}' contents of {GithubOrganization}/{projectName}: {responseContent}");
		}

		try
		{
			JsonDocument jsonDocument = JsonDocument.Parse(responseContent);
			foreach (JsonElement file in jsonDocument.RootElement.EnumerateArray())
			{
				await DownloadFileOrDirectory(client, projectName, "/", file, baseDirectory);
			}
		}
		catch (JsonException e)
		{
			Log.Error($"Could not parse JSON: {e.Message}\n{responseContent}");
		}
	}

	async Task DownloadFileOrDirectory(HttpClient client, string projectName, string subPath,
		JsonElement fileOrDirectory, AbsolutePath targetDirectory)
	{
		string name = fileOrDirectory.GetProperty("name").GetString()!;
		string filePath = targetDirectory / name;
		HttpResponseMessage fileResponse =
			await client.GetAsync(
				$"https://api.github.com/repos/{GithubOrganization}/{projectName}/contents/{SourceDocsPath}{subPath}{name}");
		string fileResponseContent = await fileResponse.Content.ReadAsStringAsync();
		using JsonDocument document = JsonDocument.Parse(fileResponseContent);
		if (document.RootElement.ValueKind == JsonValueKind.Array)
		{
			AbsolutePath subDirectory = targetDirectory / name;
			subDirectory.CreateDirectory();
			foreach (JsonElement subFileOrDirectory in document.RootElement.EnumerateArray())
			{
				await DownloadFileOrDirectory(client, projectName, subPath + name + "/", subFileOrDirectory, subDirectory);
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
