# Testably.Site

The documentation portal and webhook services powering [testably.org](https://testably.org), aggregating docs across all Testably projects.

## How it works

Each Testably project owns its documentation content under `Docs/pages/docs/` in its own repository.
This repo holds only the [Docusaurus](https://docusaurus.io/) scaffold (theme, navigation, config).

When a source repository pushes documentation changes, it dispatches a `extension-documentation-updated-event`
to this repo. The Pages workflow downloads each project's `Docs/pages/docs/` over the GitHub API, drops it
into the local `Docs/pages/docs/` directory, builds the site, and deploys to GitHub Pages at
[docs.testably.org](https://docs.testably.org).

The list of aggregated source repositories lives in `Pipeline/Build.Pages.cs`
(`AggregatedSources` array — one entry per docs slice; a single repo can contribute multiple slices).

## Layout

- `Source/Testably.Server/` — ASP.NET Core service for shared webhooks (e.g. PR title / conventional-commits status check).
- `Docs/pages/` — Docusaurus scaffold. The `docs/` subdirectory is fetched at build time and is gitignored.
- `Pipeline/` — [Nuke](https://nuke.build/) build with the `Pages` target that aggregates docs from sibling repositories.

## Building the docs locally

```bash
./build.sh Pages              # downloads docs content from sibling repositories
cd Docs/pages
npm ci
npm start                     # local preview at http://localhost:3000
```

## Adding another aggregated project

Add an entry to the `AggregatedProjects` dictionary in `Pipeline/Build.Pages.cs`. The key is the GitHub
repository name (under the Testably org); the value is the subdirectory under `Docs/pages/docs/` where its
content should land (empty string places it at the root). The source repository must keep its content under
`Docs/pages/docs/`.
