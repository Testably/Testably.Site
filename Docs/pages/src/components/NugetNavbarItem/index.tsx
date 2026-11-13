/**
 * The NuGet link in the navbar: the package of the current module in the URL (see NavbarModule). Hidden on the home
 * page and any non-section route, where no single package fits.
 */
import React, {type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import type {Props} from '@theme/NavbarItem/DefaultNavbarItem';
import {getNavbarModule} from '@site/src/components/NavbarModule';

export default function NugetNavbarItem(props: Props): ReactNode {
  const module = getNavbarModule(useLocation().pathname);
  if (!module) return null;
  return <DefaultNavbarItem {...props} href={`https://www.nuget.org/packages/${module.package}`} />;
}
