namespace Testably.Site.Models;

public class PullRequestWebhookModel
{
    public string Action { get; set; } = "";
    public int Number { get; set; }

    public RepositoryModel Repository { get; set; } = default!;
}
