using Nuke.Common;

namespace Build;

partial class Build : NukeBuild
{
	[Parameter("Github Token")] readonly string? GithubToken;

	public static int Main() => Execute<Build>(x => x.Pages);
}
