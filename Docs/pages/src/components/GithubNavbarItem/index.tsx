/**
 * The GitHub link in the navbar: the repository of the current module in the URL (see NavbarModule), or the Testably
 * organization on the home page and any non-section route.
 */
import React, {type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import type {Props} from '@theme/NavbarItem/DefaultNavbarItem';
import {getNavbarModule} from '@site/src/components/NavbarModule';

export default function GithubNavbarItem(props: Props): ReactNode {
  const module = getNavbarModule(useLocation().pathname);
  const href = module ? `https://github.com/Testably/${module.repository}` : 'https://github.com/Testably';
  return <DefaultNavbarItem {...props} href={href} />;
}
