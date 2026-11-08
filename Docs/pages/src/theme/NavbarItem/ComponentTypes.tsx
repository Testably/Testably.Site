/**
 * Swizzled (wrapped) navbar item types, adding `custom-githubLink` and `custom-nugetLink`.
 */
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import GithubNavbarItem from '@site/src/components/GithubNavbarItem';
import NugetNavbarItem from '@site/src/components/NugetNavbarItem';

export default {
  ...ComponentTypes,
  'custom-githubLink': GithubNavbarItem,
  'custom-nugetLink': NugetNavbarItem,
};
