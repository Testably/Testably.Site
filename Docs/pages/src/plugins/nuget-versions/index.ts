/**
 * Reads the latest stable and pre-release version of each configured package from NuGet at build time and
 * exposes them as global data for the `PackageInstall` component. The libraries trigger a site build after
 * each release, so the versions stay current without a request from the browser.
 */
import type {LoadContext, Plugin} from '@docusaurus/types';

export type PackageVersion = {stable?: string; latest: string};
export type PackageVersions = Record<string, PackageVersion>;

type Options = {packages: string[]};

// A single network hiccup on the build runner should not fail the deployment.
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

async function readJson<T>(id: string, url: string): Promise<T> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Could not read the versions of '${id}' from NuGet (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

type RegistrationPage = {'@id': string; items?: {catalogEntry: {version: string; listed?: boolean}}[]};

/**
 * Only the registration knows which versions are unlisted, but it can lag behind the flat container, so a fresh
 * release missing from it still counts as listed.
 */
async function readUnlistedVersions(id: string): Promise<Set<string>> {
  const index = await readJson<{items: RegistrationPage[]}>(
    id,
    `https://api.nuget.org/v3/registration5-gz-semver2/${id.toLowerCase()}/index.json`,
  );
  const pages = await Promise.all(
    index.items.map((page) => (page.items ? page : readJson<RegistrationPage>(id, page['@id']))),
  );
  return new Set(
    pages
      .flatMap((page) => page.items ?? [])
      .filter((item) => item.catalogEntry.listed === false)
      .map((item) => item.catalogEntry.version.toLowerCase()),
  );
}

async function readVersions(id: string): Promise<PackageVersion> {
  const [{versions: all}, unlisted] = await Promise.all([
    readJson<{versions: string[]}>(id, `https://api.nuget.org/v3-flatcontainer/${id.toLowerCase()}/index.json`),
    readUnlistedVersions(id),
  ]);
  const versions = all.filter((version) => !unlisted.has(version));
  return {
    stable: versions.filter((version) => !version.includes('-')).at(-1),
    latest: versions.at(-1)!,
  };
}

export default function nugetVersionsPlugin(_context: LoadContext, options: Options): Plugin<PackageVersions> {
  return {
    name: 'nuget-versions',
    async loadContent() {
      const entries = await Promise.all(
        options.packages.map(async (id) => [id, await readVersions(id)] as const),
      );
      return Object.fromEntries(entries);
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData(content);
    },
  };
}
