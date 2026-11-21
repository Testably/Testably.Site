/**
 * Swizzled (ejected) NotFound content: instead of the stock dead end, it offers the three libraries to continue with.
 * The Awaiten docs moved to their own site; GitHub Pages cannot redirect server-side, so the old `/Awaiten/...` links
 * land here and are forwarded to the same path on the new site.
 */
import React, {type ReactNode, useEffect} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import Heading from '@theme/Heading';
import ThemedImage from '@theme/ThemedImage';
import type {Props} from '@theme/NotFound/Content';
import styles from './styles.module.css';

const AWAITEN_SITE = 'https://awaiten-dev.github.io/Awaiten';
const AWAITEN_PATTERN = /^\/awaiten(\/.*)?$/i;

const libraries = [
  {key: 'abstractions', label: 'Testably.Abstractions', tagline: 'Mock the unmockable.', href: '/Abstractions/', icon: 'testably-abstractions'},
  {key: 'awexpect', label: 'aweXpect', tagline: 'Readable, AOT-ready assertions.', href: '/aweXpect/', icon: 'awexpect'},
  {key: 'mockolate', label: 'Mockolate', tagline: 'AOT-ready mocking for .NET.', href: '/Mockolate/', icon: 'mockolate'},
];

function LibraryLink({library}: {library: (typeof libraries)[number]}): ReactNode {
  return (
    <Link to={library.href} className={clsx(styles.library, styles[library.key])}>
      <ThemedImage
        sources={{light: useBaseUrl(`img/${library.icon}-light.svg`), dark: useBaseUrl(`img/${library.icon}-dark.svg`)}}
        alt=""
        width={40}
        height={40}
      />
      <span>
        <span className={styles.name}>{library.label}</span>
        <span className={styles.tagline}>{library.tagline}</span>
      </span>
    </Link>
  );
}

export default function NotFoundContent({className}: Props): ReactNode {
  const {pathname, search, hash} = useLocation();
  const match = pathname.match(AWAITEN_PATTERN);
  const target = match ? `${AWAITEN_SITE}${match[1] ?? '/'}${search}${hash}` : null;
  useEffect(() => {
    if (target) {
      window.location.replace(target);
    }
  }, [target]);
  return (
    <main className={clsx('container margin-vert--xl', className)}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1">Page not found</Heading>
          <p>This page does not exist, or it has moved. Pick a library to continue, or use the search at the top.</p>
          <div className={styles.libraries}>
            {libraries.map((library) => (
              <LibraryLink key={library.key} library={library} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
