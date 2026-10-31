# Docs style guide

These rules apply to every page published on [docs.testably.org](https://docs.testably.org): the `Docs/pages` folders of the library repositories (aweXpect also `Docs/extensions`) that `Pipeline/Build.Pages.cs` aggregates into this site. READMEs follow their own section at the end.

The site build fails on broken links and anchors, so every rule that the build can check is checked there.

## Language

- Write US English: behavior, initialize, customize, serialize. It matches the .NET and library API names next to the prose.
- Use sentence case for every heading, sidebar label, category label and tab label: "Getting started", "Advanced features". Proper names and identifiers keep their spelling: "Central Package Management", `MockBehavior`.
- Do not use em dashes. Use a period, comma, colon, semicolon or parentheses instead.
- Write one line per paragraph. Do not hard-wrap prose; editors soft-wrap, and diffs then show exactly the changed sentence. This applies to new and edited paragraphs; existing pages are not reformatted just for this rule.

## Files and front matter

- Order pages and folders with a two-digit prefix that is unique within its folder: `04-create-mocks.md`, `05-setup/`. The landing page of a folder is `00-index.md`. Leave gaps so new pages can slot in. The site strips the prefix from the URL.
- Every page has a `description` in its front matter. Search engines, link previews and generated category pages show it.
- The H1 is the page title. Add `title` only to pages without an H1, such as MDX pages that start with a component, and `sidebar_label` only when the sidebar needs a shorter name.

```markdown
---
description: Verify how often and in which order a mock was called.
---

# Verify interactions
```

## Links

- Within a repository, link to the file with a relative path, so the link also works on GitHub: `[Parameter matching](./06-parameter-matching.md#custom-matchers)`.
- Across libraries, link with the site-absolute path: `[aweXpect.Mockolate](/aweXpect/extensions/aweXpect.Mockolate/)`. The build checks it; a full `https://docs.testably.org/...` URL it does not.
- A page that is published inside another repository's section (e.g. Mockolate.Migration's page in the Mockolate migration section) links to its neighbors with relative paths as they are on the site.

## Page structure

### Library start page

```markdown
# Mockolate

<one or two sentence pitch>

<short example; with its failure message if the library produces one>

## Why Mockolate?

<comparison with the alternatives readers know>

## Where to go next

<links: getting started, key concepts, migration>
```

### Getting started page

```markdown
# Getting started

## Requirements

<SDK, target frameworks, language version, as :::info>

## Install the package

<PackageInstall package="Mockolate" />

## Write your first test

<complete example, see "Code examples">

## Next steps
```

### Extension, companion or migration package page

```markdown
# aweXpect.Logging

<pitch: what it does, which library it extends, linked site-absolute>

## Installation

<PackageInstall package="aweXpect.Logging" />

<that it also needs aweXpect, and the namespace to import if it is not `aweXpect`>

## At a glance

<example with its failure message>

## Overview

<table of the features, linking the subpages>
```

## Installation

Install instructions always use the shared component, which shows tabs for the .NET CLI, a PackageReference and Central Package Management with the latest version from NuGet. Never write the commands by hand on a docs page.

```mdx
import PackageInstall from '@site/src/components/PackageInstall';

<PackageInstall package="Mockolate" />
```

- `package` takes one id or a list: `package={['aweXpect', 'aweXpect.Json']}`. Use separate components when the packages go into different projects.
- `prerelease` installs the latest pre-release, while the documented version is not yet stable.
- `developmentDependency` adds `PrivateAssets="all"`, for analyzer-only packages such as the migration packages.
- A new package id must be added to the `nuget-versions` plugin in `Docs/pages/docusaurus.config.ts`; the build fails otherwise.
- Do not add NuGet badges to docs pages; the component already shows the version and links to NuGet.

## Code examples

- Use the language tags `csharp`, `xml`, `json`, `text` and `shell` (for commands).
- Use explicit types instead of `var`, as in the libraries' code.
- Each library keeps one running example, e.g. the `IChocolateDispenser` for Mockolate and the coffee shop for Awaiten. Reuse its types instead of inventing new ones, and declare added members next to the example.
- `sut` is the system under test, never the mock.
- Add a `title` only when it names a file (`Directory.Packages.props`) or a role (`Production code`).

### Snippets and complete examples

The first example on a getting-started page is a complete test that readers can copy: `using`s, class and a TUnit test method (`[Test]`, and `[Arguments(...)]` for parameterized tests). All other examples are snippets without that boilerplate.

```csharp title="VendingMachineTests.cs"
using Mockolate;
using static aweXpect.Expect;

public class VendingMachineTests
{
    [Test]
    [Arguments("Dark", "Enjoy!")]
    public async Task Buy_ShouldDispenseChocolate(string type, string expected)
    {
        IChocolateDispenser dispenser = IChocolateDispenser.CreateMock();
        dispenser.Mock.Setup.Dispense(type, 1).Returns(true);
        VendingMachine sut = new(dispenser);

        string result = sut.Buy(type, 1);

        await That(result).IsEqualTo(expected);
    }
}
```

### Expected results

- Where an example checks a result, use aweXpect in the form `await That(...)`. Comments are fine for intermediate values inside an explanation.
- Add `.Because(...)` only where it explains why the result is what it is.
- Pages of libraries other than aweXpect mention once (on the getting-started page) that aweXpect is used in the examples and is optional.
- Migration pages are the exception: they show the code of the library you migrate from.

```csharp
await That(dispenser.TotalDispensed).IsEqualTo(5)
    .Because("the property stores the last written value");
```

### Failure messages

Show a failure message in a `text` block with the title "Failure message", directly after the code that produces it.

````markdown
```text title="Failure message"
Expected that mock invoked method Dispense(Milk, It.IsAny<int>()) exactly once,
but it never did.
```
````

## Callouts

Use Docusaurus admonitions, never italic "*Note:*" paragraphs. Each type has one meaning:

| Admonition | Use it for                                                     |
|------------|----------------------------------------------------------------|
| `:::note`    | Extra information that is good to know but not required.       |
| `:::tip`     | A recommendation: the better way to do something.             |
| `:::info`    | A requirement: framework, language version or package.         |
| `:::warning` | A pitfall that leads to wrong results or confusing failures.   |
| `:::danger`  | Something that loses data or breaks consumers.                 |

Add a title in brackets when it carries information, e.g. `:::info[.NET 8 or later]`. Put long background explanations into `<details>` instead of a callout.

## Diagrams

Draw a Mermaid diagram (a fenced `mermaid` block) where a structure or flow is easier to grasp as a picture than as prose. Keep it small enough to fit on one screen, and show only relationships the page states.

## READMEs

The README is the landing page on GitHub and NuGet, which render plain markdown only. It is maintained separately from the docs pages, so keep shared content (e.g. overview tables) in sync by hand.

- Plain markdown only: no MDX imports, components or admonitions.
- An `## Installation` section with a plain `dotnet add package <id>` in a `shell` block; add `--prerelease` while the documented version is a pre-release.
- Link to the docs with full `https://docs.testably.org/...` URLs; relative links do not resolve on NuGet.
- Badges belong here, not on docs pages.
- The language rules above apply too.

## Short rules for AGENTS.md

Each library repository repeats these rules in its `AGENTS.md` and links this guide:

```markdown
## Documentation

Pages under `Docs/pages` are published on docs.testably.org and follow the [docs style guide](https://github.com/Testably/Testably.Site/blob/main/Docs/style-guide.md). The key rules:

- US English, sentence case for headings and labels, no em dashes, one line per paragraph.
- A `description` in the front matter of every page; the H1 is the title; order with unique `NN-` prefixes.
- Relative file links within the repository, site-absolute `/Library/...` links across libraries.
- Install instructions only through `<PackageInstall package="..." />`, never hand-written commands or NuGet badges.
- Examples check results with `await That(...)`; complete examples use TUnit `[Test]`.
```
