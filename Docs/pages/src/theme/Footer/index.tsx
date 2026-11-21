/**
 * Swizzled (ejected) footer: a sitemap with a column for Testably and one per library, above a row with the logo,
 * the tagline and the copyright.
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
    <div className="col footer__col">
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
      <div className="container container-fluid">
        <div className="row footer__links">
          <Column title="Testably" repository="Testably">
            <Item href="/">Home</Item>
            <Item href="https://github.com/sponsors/Testably">Sponsor</Item>
          </Column>
          <Column title="Abstractions" repository="Testably/Testably.Abstractions" nuget="Testably.Abstractions.Testing">
            <Item href="/Abstractions/getting-started">Getting started</Item>
            <Item href="/Abstractions/migration">Migration</Item>
            <Item href="/Abstractions/changelog">Changelog</Item>
          </Column>
          <Column title="aweXpect" repository="Testably/aweXpect" nuget="aweXpect">
            <Item href="/aweXpect/getting-started">Getting started</Item>
            <Item href="/aweXpect/extensions">Extensions</Item>
            <Item href="/aweXpect/migration">Migration</Item>
            <Item href="/aweXpect/changelog">Changelog</Item>
          </Column>
          <Column title="Mockolate" repository="Testably/Mockolate" nuget="Mockolate">
            <Item href="/Mockolate/getting-started">Getting started</Item>
            <Item href="/Mockolate/benchmarks">Benchmarks</Item>
            <Item href="/Mockolate/migration">Migration</Item>
            <Item href="/Mockolate/changelog">Changelog</Item>
          </Column>
        </div>
        <div className="footer__bottom footer__brand-row">
          <span>© {new Date().getFullYear()} Testably</span>
          <img src={useBaseUrl('img/testably-dark.svg')} alt="" width={32} height={32} />
          <span>Open-source testing libraries for .NET</span>
        </div>
      </div>
    </footer>
  );
}
