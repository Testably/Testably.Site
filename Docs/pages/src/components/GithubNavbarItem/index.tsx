/**
 * The GitHub link in the navbar: the repository of the current section in the URL, or the Testably organization on
 * the home page and any non-section route.
 */
import React, {type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import type {Props} from '@theme/NavbarItem/DefaultNavbarItem';

const SECTION_REPOSITORIES: Record<string, string> = {
  abstractions: 'Testably.Abstractions',
  awexpect: 'aweXpect',
  mockolate: 'Mockolate',
  awaiten: 'Awaiten',
};

const SECTION_PATTERN = /^\/(abstractions|awexpect|mockolate|awaiten)(?:\/|$)/i;

export default function GithubNavbarItem(props: Props): ReactNode {
  const section = useLocation().pathname.match(SECTION_PATTERN)?.[1].toLowerCase();
  const href = section ? `https://github.com/Testably/${SECTION_REPOSITORIES[section]}` : 'https://github.com/Testably';
  return <DefaultNavbarItem {...props} href={href} />;
}
