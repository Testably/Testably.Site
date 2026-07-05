import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import ThemedImage from '@theme/ThemedImage';
import styles from './index.module.css';

type Library = {
  label: string;
  href: string;
  tagline: string;
  description: string;
  iconLight: string;
  iconDark: string;
};

const libraries: Library[] = [
  {
    label: 'Testably.Abstractions',
    href: '/Abstractions/',
    tagline: 'Mock the unmockable.',
    description:
      'IFileSystem, ITimeSystem and IRandomSystem abstractions with feature-complete in-memory mocks for deterministic, cross-platform unit tests.',
    iconLight: 'img/testably-abstractions-light.svg',
    iconDark: 'img/testably-abstractions-dark.svg',
  },
  {
    label: 'aweXpect',
    href: '/aweXpect/',
    tagline: 'Fluent expectations for .NET.',
    description:
      'A modern, async-first assertion library with a natural-language API. Plays well with xUnit, NUnit, MSTest and TUnit.',
    iconLight: 'img/awexpect-light.svg',
    iconDark: 'img/awexpect-dark.svg',
  },
  {
    label: 'Mockolate',
    href: '/Mockolate/',
    tagline: 'AOT-friendly mocking via source generators.',
    description:
      'Strongly-typed, source-generator-based mocking for .NET. No runtime proxies, no reflection, native-AOT compatible.',
    iconLight: 'img/mockolate-light.svg',
    iconDark: 'img/mockolate-dark.svg',
  },
  {
    label: 'Awaiten',
    href: '/Awaiten/',
    tagline: 'The async-first DI container.',
    description:
      'A source-generator dependency injection container. No runtime reflection, compile-time-verified wiring, and first-class async initialization. Native-AOT clean.',
    iconLight: 'img/awaiten.png',
    iconDark: 'img/awaiten.png',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
      </div>
    </header>
  );
}

function LibraryCard({library}: {library: Library}) {
  const lightSrc = useBaseUrl(library.iconLight);
  const darkSrc = useBaseUrl(library.iconDark);
  return (
    <div className="col col--3" style={{marginBottom: '1.5rem'}}>
      <div
        style={{
          padding: '1.5rem',
          border: '1px solid var(--ifm-color-emphasis-200)',
          borderRadius: 'var(--ifm-card-border-radius)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <ThemedImage
          sources={{light: lightSrc, dark: darkSrc}}
          alt={`${library.label} logo`}
          width={96}
          height={96}
          style={{marginBottom: '0.75rem'}}
        />
        <Heading as="h3">{library.label}</Heading>
        <p style={{fontStyle: 'italic', color: 'var(--ifm-color-emphasis-700)'}}>
          {library.tagline}
        </p>
        <p style={{flexGrow: 1}}>{library.description}</p>
        <Link className="button button--primary" to={library.href}>
          Read the docs
        </Link>
      </div>
    </div>
  );
}

function LibraryCards() {
  return (
    <section className={styles.codeSample}>
      <div className="container">
        <div className="row">
          {libraries.map((library) => (
            <LibraryCard key={library.label} library={library} />
          ))}
        </div>
        <div className="text--center" style={{marginTop: '2rem'}}>
          <p>
            Looking for add-ons? See the{' '}
            <Link to="/Extensions/">Extensions</Link> section.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Documentation for the Testably family of testing libraries: Testably.Abstractions, aweXpect, Mockolate and Awaiten."
    >
      <HomepageHeader />
      <main>
        <LibraryCards />
      </main>
    </Layout>
  );
}
