using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Testably.Site.Pages;

public class IndexModel : PageModel
{
    public IActionResult OnGet()
        => RedirectPermanent("https://docs.testably.org");
}