/**
 * The NuGet link in the navbar: the package a test project installs for the current section in the URL. Hidden on the
 * home page and any non-section route, where no single package fits.
 */
import React, {type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import type {Props} from '@theme/NavbarItem/DefaultNavbarItem';

const SECTION_PACKAGES: Record<string, string> = {
  abstractions: 'Testably.Abstractions.Testing',
  awexpect: 'aweXpect',
  mockolate: 'Mockolate',
};

const SECTION_PATTERN = /^\/(abstractions|awexpect|mockolate)(?:\/|$)/i;

export default function NugetNavbarItem(props: Props): ReactNode {
  const section = useLocation().pathname.match(SECTION_PATTERN)?.[1].toLowerCase();
  if (!section) return null;
  return <DefaultNavbarItem {...props} href={`https://www.nuget.org/packages/${SECTION_PACKAGES[section]}`} />;
}
