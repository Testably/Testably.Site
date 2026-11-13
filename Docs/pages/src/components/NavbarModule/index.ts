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

// The first match wins, so a page of a package comes before the pages of its parent route. Json, Reflection, Snapshots,
// Web and Xml are released from the aweXpect repository; the other packages have a repository of their own.
const PACKAGE_ROUTES: [RegExp, NavbarModule][] = [
  [/^\/awexpect\/extensions\/awexpect\.json(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Json'}],
  [/^\/awexpect\/extensions\/awexpect\.reflection(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Reflection'}],
  [/^\/awexpect\/extensions\/awexpect\.snapshots\/diff-tools(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Snapshots.DiffEngine'}],
  [/^\/awexpect\/extensions\/awexpect\.snapshots\/public-api(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Snapshots.PublicApi'}],
  [/^\/awexpect\/extensions\/awexpect\.snapshots(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Snapshots'}],
  [/^\/awexpect\/extensions\/awexpect\.web(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Web'}],
  [/^\/awexpect\/extensions\/awexpect\.xml(?:\/|$)/i, {repository: 'aweXpect', package: 'aweXpect.Xml'}],
  [/^\/awexpect\/extensions\/awexpect\.logging(?:\/|$)/i, {repository: 'aweXpect.Logging', package: 'aweXpect.Logging'}],
  [/^\/awexpect\/extensions\/awexpect\.mockolate(?:\/|$)/i, {repository: 'aweXpect.Mockolate', package: 'aweXpect.Mockolate'}],
  [/^\/awexpect\/extensions\/awexpect\.testably(?:\/|$)/i, {repository: 'aweXpect.Testably', package: 'aweXpect.Testably'}],
  [/^\/awexpect\/chronology(?:\/|$)/i, {repository: 'aweXpect.Chronology', package: 'aweXpect.Chronology'}],
  [/^\/awexpect\/migration(?:\/|$)/i, {repository: 'aweXpect.Migration', package: 'aweXpect.Migration'}],
  [/^\/mockolate\/migration\/automated(?:\/|$)/i, {repository: 'Mockolate.Migration', package: 'Mockolate.Migration'}],
  [/^\/abstractions\/migration-from-testableio\/migration(?:\/|$)/i, {repository: 'Testably.Abstractions.Migration', package: 'Testably.Abstractions.Migration'}],
];

export function getNavbarModule(pathname: string): NavbarModule | null {
  const module = PACKAGE_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];
  if (module) return module;
  const section = pathname.match(SECTION_PATTERN)?.[1].toLowerCase();
  return section ? SECTIONS[section] : null;
}
