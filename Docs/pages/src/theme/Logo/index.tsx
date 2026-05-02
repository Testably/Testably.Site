/**
 * Swizzled Logo. Picks the SVG icon based on the current section in the URL,
 * falling back to the multi-color umbrella icon for the home page and any
 * non-section route. Light/dark variant selection is delegated to ThemedImage.
 */
import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig} from '@docusaurus/theme-common';
import ThemedImage from '@theme/ThemedImage';
import type {Props} from '@theme/Logo';

const SECTION_LOGOS: Record<string, {light: string; dark: string}> = {
  abstractions: {
    light: 'img/testably-abstractions-light.svg',
    dark: 'img/testably-abstractions-dark.svg',
  },
  awexpect: {
    light: 'img/awexpect-light.svg',
    dark: 'img/awexpect-dark.svg',
  },
  mockolate: {
    light: 'img/mockolate-light.svg',
    dark: 'img/mockolate-dark.svg',
  },
};

const DEFAULT_LOGO = {
  light: 'img/testably-light.svg',
  dark: 'img/testably-dark.svg',
};

const SECTION_PATTERN = /^\/docs\/(abstractions|awexpect|mockolate)/;

function pickLogo(pathname: string) {
  const match = pathname.match(SECTION_PATTERN);
  return match ? SECTION_LOGOS[match[1]] : DEFAULT_LOGO;
}

export default function Logo(props: Props): ReactNode {
  const {siteConfig: {title}} = useDocusaurusContext();
  const {navbar: {title: navbarTitle, logo}} = useThemeConfig();
  const {imageClassName, titleClassName, ...propsRest} = props;

  const {pathname} = useLocation();
  const sources = pickLogo(pathname);
  const lightSrc = useBaseUrl(sources.light);
  const darkSrc = useBaseUrl(sources.dark);
  const logoLink = useBaseUrl(logo?.href || '/');

  const fallbackAlt = navbarTitle ? '' : title;
  const alt = logo?.alt ?? fallbackAlt;

  const themedImage = (
    <ThemedImage
      className={logo?.className}
      sources={{light: lightSrc, dark: darkSrc}}
      height={logo?.height ?? 32}
      width={logo?.width ?? 32}
      alt={alt}
      style={logo?.style}
    />
  );

  return (
    <Link
      to={logoLink}
      {...propsRest}
      {...(logo?.target && {target: logo.target})}>
      {imageClassName ? (
        <div className={imageClassName}>{themedImage}</div>
      ) : (
        themedImage
      )}
      {navbarTitle != null && <b className={titleClassName}>{navbarTitle}</b>}
    </Link>
  );
}
