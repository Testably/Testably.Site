using System.Net;
using System.Text;
using System.Text.Json;
using Mockolate;

namespace Testably.Site.Tests;

public class PullRequestStatusCheckTests
{
	[Test]
	[Arguments("fix: description", "success")]
	[Arguments("feat: description", "success")]
	[Arguments("release: description", "success")]
	[Arguments("fix!: description", "success")]
	[Arguments("fix(deps): description", "success")]
	[Arguments("fix(deps)!: description", "success")]
	[Arguments("description", "failure")]
	[Arguments("unknown: description", "failure")]
	[Arguments("feature: description", "failure")]
	[Arguments("fix:description", "failure")]
	[Arguments("fix(): description", "failure")]
	[Arguments("fix(deps: description", "failure")]
	public async Task ShouldReportWhetherTheTitleIsConventional(string title, string expectedState)
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub(title,
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		await That(sentStatusCheck).Contains($"\"state\":\"{expectedState}\"");
	}

	[Test]
	public async Task WhenTitleEndsWithTheSeparator_ShouldReportFailureInsteadOfThrowing()
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub("fix:",
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		await That(sentStatusCheck).Contains("\"state\":\"failure\"");
	}

	[Test]
	public async Task ShouldPostTheStatusAsJson()
	{
		string? sentMediaType = null;
		var httpClientFactoryMock = MockGitHub("feat: description",
			onStatusPosted: (request, _) => sentMediaType = request.Content?.Headers.ContentType?.MediaType);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		await That(sentMediaType).IsEqualTo("application/json");
	}

	[Test]
	public async Task WhenTheStatusIsRejected_ShouldReportAServerError()
	{
		var httpClientFactoryMock = MockGitHub("feat: description",
			statusResult: HttpStatusCode.UnprocessableEntity);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		await That(response.StatusCode).IsEqualTo(HttpStatusCode.InternalServerError);
	}

	[Test]
	[Arguments("closed")]
	[Arguments("labeled")]
	[Arguments("assigned")]
	public async Task WhenTheActionCannotHaveChangedTheTitle_ShouldNotCallGitHub(string action)
	{
		var requests = 0;
		var httpClientFactoryMock = MockGitHub("feat: description", onAnyRequest: () => requests++);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory, action);

		response.EnsureSuccessStatusCode();
		await That(requests).IsEqualTo(0);
	}

	[Test]
	[Arguments("opened")]
	[Arguments("edited")]
	[Arguments("reopened")]
	[Arguments("synchronize")]
	[Arguments("ready_for_review")]
	public async Task WhenTheActionCanHaveChangedTheTitle_ShouldPostTheStatus(string action)
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub("feat: description",
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory, action);

		response.EnsureSuccessStatusCode();
		await That(sentStatusCheck).Contains("\"state\":\"success\"");
	}

	[Test]
	[Arguments("Testably", "testablyToken")]
	[Arguments("aweXpect", "aweXpectToken")]
	[Arguments("TestableIO", "TestableIOToken")]
	[Arguments("awaiten-dev", "awaitenDevToken")]
	public async Task ShouldPostTheStatusWithTheTokenOfTheOwner(string owner, string tokenKey)
	{
		string? sentAuthorization = null;
		Uri? sentStatusUri = null;
		var httpClientFactoryMock = MockGitHub("feat: description",
			onStatusPosted: (request, _) =>
			{
				sentAuthorization = request.Headers.Authorization?.ToString();
				sentStatusUri = request.RequestUri;
			});
		await using var factory = new TestFactory(httpClientFactoryMock,
			c => c.Add(tokenKey, "foo"));

		var response = await PostWebhook(factory, owner: owner);

		response.EnsureSuccessStatusCode();
		await That(sentAuthorization).IsEqualTo("Bearer foo");
		await That(sentStatusUri?.AbsoluteUri).IsEqualTo($"https://api.github.com/repos/{owner}/aweXpect/statuses/884edd06");
	}

	#region Helpers

	private static async Task<HttpResponseMessage> PostWebhook(TestFactory factory, string action = "opened",
		string owner = "Testably")
	{
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Add("x-github-event", "pull_request");
		using var content = new StringContent(WebhookPayload(action, owner), Encoding.UTF8, "application/json");
		return await client.PostAsync("pr-status-check", content);
	}

	private static string WebhookPayload(string action, string owner)
		=> $$"""
		     {
		       "action": "{{action}}",
		       "number": 1079,
		       "repository": {
		         "name": "aweXpect",
		         "private": false,
		         "owner": { "login": "{{owner}}" }
		       }
		     }
		     """;

	private static IHttpClientFactory MockGitHub(
		string title,
		HttpStatusCode statusResult = HttpStatusCode.Created,
		Action<HttpRequestMessage, string?>? onStatusPosted = null,
		Action? onAnyRequest = null)
	{
		var mockHttpMessageHandler = HttpMessageHandler.CreateMock();
		mockHttpMessageHandler.Mock.SetupProtected
			.SendAsync(It.IsAny<HttpRequestMessage>(), It.IsAny<CancellationToken>())
			.ReturnsAsync((request, _) =>
			{
				onAnyRequest?.Invoke();
				if (request.Method == HttpMethod.Get)
				{
					return new HttpResponseMessage(HttpStatusCode.OK)
					{
						Content = new StringContent(
							"{\"title\":" + JsonSerializer.Serialize(title) +
							",\"head\":{\"sha\":\"884edd06\"}}")
					};
				}

				onStatusPosted?.Invoke(request, request.Content?.ReadAsStringAsync().Result);
				return new HttpResponseMessage(statusResult)
				{
					Content = new StringContent("{}")
				};
			});

		var httpClientFactoryMock = IHttpClientFactory.CreateMock();
		httpClientFactoryMock.Mock.Setup.CreateClient(It.IsAny<string>())
			.Returns(() => new HttpClient(mockHttpMessageHandler, disposeHandler: false));
		return httpClientFactoryMock;
	}

	#endregion
}
