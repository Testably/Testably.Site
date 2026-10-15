using Fallout.Common;

namespace Build;

partial class Build : FalloutBuild
{
	[Parameter("Github Token")] readonly string? GithubToken;

	public static int Main() => Execute<Build>(x => x.Pages);
}
