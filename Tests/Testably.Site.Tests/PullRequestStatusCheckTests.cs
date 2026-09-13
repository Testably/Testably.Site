using System.Net;
using System.Text;
using System.Text.Json;
using Moq;
using Moq.Protected;

namespace Testably.Site.Tests;

public class PullRequestStatusCheckTests
{
	[Theory]
	[InlineData("fix: description", "success")]
	[InlineData("feat: description", "success")]
	[InlineData("release: description", "success")]
	[InlineData("fix!: description", "success")]
	[InlineData("fix(deps): description", "success")]
	[InlineData("fix(deps)!: description", "success")]
	[InlineData("description", "failure")]
	[InlineData("unknown: description", "failure")]
	[InlineData("feature: description", "failure")]
	[InlineData("fix:description", "failure")]
	[InlineData("fix(): description", "failure")]
	[InlineData("fix(deps: description", "failure")]
	public async Task ShouldReportWhetherTheTitleIsConventional(string title, string expectedState)
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub(title,
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		Assert.Contains($"\"state\":\"{expectedState}\"", sentStatusCheck);
	}

	[Fact]
	public async Task WhenTitleEndsWithTheSeparator_ShouldReportFailureInsteadOfThrowing()
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub("fix:",
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		Assert.Contains("\"state\":\"failure\"", sentStatusCheck);
	}

	[Fact]
	public async Task ShouldPostTheStatusAsJson()
	{
		string? sentMediaType = null;
		var httpClientFactoryMock = MockGitHub("feat: description",
			onStatusPosted: (request, _) => sentMediaType = request.Content?.Headers.ContentType?.MediaType);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		response.EnsureSuccessStatusCode();
		Assert.Equal("application/json", sentMediaType);
	}

	[Fact]
	public async Task WhenTheStatusIsRejected_ShouldReportAServerError()
	{
		var httpClientFactoryMock = MockGitHub("feat: description",
			statusResult: HttpStatusCode.UnprocessableEntity);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory);

		Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
	}

	[Theory]
	[InlineData("closed")]
	[InlineData("labeled")]
	[InlineData("assigned")]
	public async Task WhenTheActionCannotHaveChangedTheTitle_ShouldNotCallGitHub(string action)
	{
		var requests = 0;
		var httpClientFactoryMock = MockGitHub("feat: description", onAnyRequest: () => requests++);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory, action);

		response.EnsureSuccessStatusCode();
		Assert.Equal(0, requests);
	}

	[Theory]
	[InlineData("opened")]
	[InlineData("edited")]
	[InlineData("reopened")]
	[InlineData("synchronize")]
	[InlineData("ready_for_review")]
	public async Task WhenTheActionCanHaveChangedTheTitle_ShouldPostTheStatus(string action)
	{
		string? sentStatusCheck = null;
		var httpClientFactoryMock = MockGitHub("feat: description",
			onStatusPosted: (_, body) => sentStatusCheck = body);
		await using var factory = new TestFactory(httpClientFactoryMock.Object,
			c => c.Add("testablyToken", "foo"));

		var response = await PostWebhook(factory, action);

		response.EnsureSuccessStatusCode();
		Assert.Contains("\"state\":\"success\"", sentStatusCheck);
	}

	#region Helpers

	private static async Task<HttpResponseMessage> PostWebhook(TestFactory factory, string action = "opened")
	{
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Add("x-github-event", "pull_request");
		using var content = new StringContent(WebhookPayload(action), Encoding.UTF8, "application/json");
		return await client.PostAsync("pr-status-check", content);
	}

	private static string WebhookPayload(string action)
		=> $$"""
		     {
		       "action": "{{action}}",
		       "number": 1079,
		       "repository": {
		         "name": "aweXpect",
		         "private": false,
		         "owner": { "login": "Testably" }
		       }
		     }
		     """;

	private static Mock<IHttpClientFactory> MockGitHub(
		string title,
		HttpStatusCode statusResult = HttpStatusCode.Created,
		Action<HttpRequestMessage, string?>? onStatusPosted = null,
		Action? onAnyRequest = null)
	{
		var mockHttpMessageHandler = new Mock<HttpMessageHandler>();
		mockHttpMessageHandler.Protected()
			.Setup<Task<HttpResponseMessage>>(
				"SendAsync",
				ItExpr.IsAny<HttpRequestMessage>(),
				ItExpr.IsAny<CancellationToken>())
			.ReturnsAsync((HttpRequestMessage request, CancellationToken _) =>
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

		var httpClientFactoryMock = new Mock<IHttpClientFactory>();
		httpClientFactoryMock.Setup(m => m.CreateClient(It.IsAny<string>()))
			.Returns(new HttpClient(mockHttpMessageHandler.Object));
		return httpClientFactoryMock;
	}

	#endregion
}
