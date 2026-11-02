/**
 * Swizzled (wrapped) navbar item types, adding `custom-githubLink`.
 */
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import GithubNavbarItem from '@site/src/components/GithubNavbarItem';

export default {
  ...ComponentTypes,
  'custom-githubLink': GithubNavbarItem,
};
