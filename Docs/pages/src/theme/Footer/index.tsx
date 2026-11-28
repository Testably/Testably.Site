/**
 * Swizzled (ejected) footer: a brand column with the logo and tagline and one sitemap column per library, above a
 * row with the copyright and license.
 */
import React, {type ReactElement, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import PackageVersion from '@site/src/components/PackageVersion';

function Column({
  title,
  repository,
  nuget,
  children,
}: {
  title: string;
  repository: string;
  nuget?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="footer__col">
      <div className="footer__title">
        <Link href={`https://github.com/${repository}`}>{title}</Link>
        {nuget && (
          <span className="footer__version">
            <PackageVersion package={nuget} />
          </span>
        )}
      </div>
      <ul className="footer__items clean-list">{children}</ul>
    </div>
  );
}

function Item({href, children}: {href: string; children: ReactNode}): ReactElement {
  return (
    <li className="footer__item">
      <Link className="footer__link-item" href={href}>
        {children}
      </Link>
    </li>
  );
}

export default function Footer(): ReactElement {
  return (
    <footer className="footer footer--dark">
      <div className="container">
        <div className="footer__links">
          <div className="footer__col footer__brand">
            <Link href="/" className="footer__brand-logo">
              <img src={useBaseUrl('img/testably-dark.svg')} alt="" width={76} height={76} />
              <span>
                <span className="footer__brand-name">Testably</span>
                <span className="footer__tagline">Open-source testing libraries for .NET</span>
              </span>
            </Link>
          </div>
          <Column title="Abstractions" repository="Testably/Testably.Abstractions" nuget="Testably.Abstractions.Testing">
            <Item href="/Abstractions/getting-started">Getting started</Item>
            <Item href="/Abstractions/migration">Migration</Item>
            <Item href="/Abstractions/benchmarks">Benchmarks</Item>
            <Item href="/Abstractions/changelog">Changelog</Item>
          </Column>
          <Column title="aweXpect" repository="Testably/aweXpect" nuget="aweXpect">
            <Item href="/aweXpect/getting-started">Getting started</Item>
            <Item href="/aweXpect/extensions">Extensions</Item>
            <Item href="/aweXpect/migration">Migration</Item>
            <Item href="/aweXpect/benchmarks">Benchmarks</Item>
            <Item href="/aweXpect/changelog">Changelog</Item>
          </Column>
          <Column title="Mockolate" repository="Testably/Mockolate" nuget="Mockolate">
            <Item href="/Mockolate/getting-started">Getting started</Item>
            <Item href="/Mockolate/migration">Migration</Item>
            <Item href="/Mockolate/benchmarks">Benchmarks</Item>
            <Item href="/Mockolate/changelog">Changelog</Item>
          </Column>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Testably</span>
          <span>
            Released under the <Link href="https://opensource.org/license/mit">MIT license</Link>
          </span>
          <span>
            <Link href="https://github.com/Testably">GitHub</Link> ·{' '}
            <Link href="https://github.com/sponsors/Testably">Sponsor</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
