/**
 * The module whose GitHub repository and NuGet package the navbar links for a route: an aweXpect extension or a
 * migration package on its own pages, otherwise the library of the section. Null on the home page and any non-section
 * route.
 */
export type NavbarModule = {repository: string; package: string};

const SECTIONS: Record<string, NavbarModule> = {
  abstractions: {repository: 'Testably.Abstractions', package: 'Testably.Abstractions.Testing'},
  awexpect: {repository: 'aweXpect', package: 'aweXpect'},
  mockolate: {repository: 'Mockolate', package: 'Mockolate'},
};

const SECTION_PATTERN = /^\/(abstractions|awexpect|mockolate)(?:\/|$)/i;

const EXTENSION_PATTERN = /^\/awexpect\/extensions\/(awexpect\.[^/]+)/i;

// Packages built from an extension's repository that have a page of their own.
const EXTENSION_SUBPACKAGES: [RegExp, string][] = [
  [/^\/awexpect\/extensions\/awexpect\.snapshots\/diff-tools(?:\/|$)/i, 'aweXpect.Snapshots.DiffEngine'],
  [/^\/awexpect\/extensions\/awexpect\.snapshots\/public-api(?:\/|$)/i, 'aweXpect.Snapshots.PublicApi'],
];

// The upgrade guides between aweXpect versions sit under the migration route but are not about aweXpect.Migration.
const MIGRATION_PACKAGES: [RegExp, string][] = [
  [/^\/awexpect\/migration(?!\/from-awexpect)(?:\/|$)/i, 'aweXpect.Migration'],
  [/^\/mockolate\/migration\/automated(?:\/|$)/i, 'Mockolate.Migration'],
  [/^\/abstractions\/migration-from-testableio\/migration(?:\/|$)/i, 'Testably.Abstractions.Migration'],
];

export function getNavbarModule(pathname: string): NavbarModule | null {
  const extension = pathname.match(EXTENSION_PATTERN)?.[1];
  if (extension) {
    const subpackage = EXTENSION_SUBPACKAGES.find(([pattern]) => pattern.test(pathname))?.[1];
    return {repository: extension, package: subpackage ?? extension};
  }
  const name = MIGRATION_PACKAGES.find(([pattern]) => pattern.test(pathname))?.[1];
  if (name) return {repository: name, package: name};
  const section = pathname.match(SECTION_PATTERN)?.[1].toLowerCase();
  return section ? SECTIONS[section] : null;
}
