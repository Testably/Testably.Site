import {useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {usePluginData} from '@docusaurus/useGlobalData';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import ThemedImage from '@theme/ThemedImage';
import type {PackageVersions} from '@site/src/plugins/nuget-versions';
import styles from './index.module.css';

type LibraryKey = 'abstractions' | 'awexpect' | 'mockolate';

type Library = {
  key: LibraryKey;
  label: string;
  packageId: string;
  href: string;
  problem: string;
  tagline: string;
  description: ReactNode;
  sample: ReactNode;
  platforms: string;
  iconLight: string;
  iconDark: string;
};

const Kw = ({children}: {children: ReactNode}) => <span className={styles.kw}>{children}</span>;
const Ty = ({children}: {children: ReactNode}) => <span className={styles.ty}>{children}</span>;
const Str = ({children}: {children: ReactNode}) => <span className={styles.str}>{children}</span>;
const Cm = ({children}: {children: ReactNode}) => <span className={styles.cm}>{children}</span>;

const libraries: Library[] = [
  {
    key: 'abstractions',
    label: 'Testably.Abstractions',
    packageId: 'Testably.Abstractions.Testing',
    href: '/Abstractions/',
    problem: 'It reads files, checks the date or rolls a dice.',
    tagline: 'Mock the unmockable.',
    description: (
      <>
        Inject <code>IFileSystem</code>, <code>ITimeSystem</code> and <code>IRandomSystem</code>. Swap in in-memory
        mocks for tests.
      </>
    ),
    sample: (
      <>
        <Ty>MockTimeSystem</Ty> time = <Kw>new</Kw>();{'\n'}
        time.TimeProvider.AdvanceBy({'\n'}
        {'    '}
        <Ty>TimeSpan</Ty>.FromDays(<Str>60</Str>));
      </>
    ),
    platforms: 'Windows, Linux, macOS',
    iconLight: 'img/testably-abstractions-light.svg',
    iconDark: 'img/testably-abstractions-dark.svg',
  },
  {
    key: 'awexpect',
    label: 'aweXpect',
    packageId: 'aweXpect',
    href: '/aweXpect/',
    problem: "When it fails, I can't tell why.",
    tagline: 'Readable, AOT-ready assertions.',
    description: <>Every expectation is awaited, for values, tasks, streams and exceptions alike.</>,
    sample: (
      <>
        <Kw>await</Kw> That(message){'\n'}
        {'    '}.IsEqualTo(<Str>"It's a compliment"</Str>);{'\n'}
        <Cm>// but it was "It's a complement"</Cm>
      </>
    ),
    platforms: 'TUnit, xUnit, NUnit, MSTest',
    iconLight: 'img/awexpect-light.svg',
    iconDark: 'img/awexpect-dark.svg',
  },
  {
    key: 'mockolate',
    label: 'Mockolate',
    packageId: 'Mockolate',
    href: '/Mockolate/',
    problem: "It needs a collaborator I don't want in the test.",
    tagline: 'AOT-ready mocking for .NET.',
    description: <>Source-generated mocks, set up with regular method calls. No reflection, no proxies.</>,
    sample: (
      <>
        dispenser.Mock.Setup{'\n'}
        {'    '}.Dispense(<Str>"Dark"</Str>, It.IsAny&lt;<Kw>int</Kw>&gt;()){'\n'}
        {'    '}.Returns(<Kw>true</Kw>);
      </>
    ),
    platforms: 'netstandard2.0 to .NET 11',
    iconLight: 'img/mockolate-light.svg',
    iconDark: 'img/mockolate-dark.svg',
  },
];

type Extension = {
  name: string;
  family?: LibraryKey;
  core?: boolean;
  intro: ReactNode;
  sample: ReactNode;
};

const extensions: Extension[] = [
  {
    name: 'Json',
    core: true,
    intro: (
      <>
        Compare JSON by its structure instead of its formatting, and check single properties of <code>JsonElement</code>{' '}
        and <code>JsonNode</code>.
      </>
    ),
    sample: (
      <>
        <Kw>await</Kw> That(json).IsEqualTo(expected).AsJson();{'\n'}
        <Kw>await</Kw> That(json).IsValidJsonMatching(<Kw>new</Kw> {'{'} title = <Str>"Let It Be"</Str> {'}'});
      </>
    ),
  },
  {
    name: 'Logging',
    intro: (
      <>
        Check the log records that a <code>FakeLogger</code> or <code>FakeLogCollector</code> collected.
      </>
    ),
    sample: (
      <>
        logger.LogWarning(<Str>"Retry limit reached"</Str>);{'\n'}
        <Kw>await</Kw> That(collector).LoggedWarning();
      </>
    ),
  },
  {
    name: 'Mockolate',
    family: 'mockolate',
    intro: <>Verify how often and in which order the methods of a Mockolate mock were invoked.</>,
    sample: (
      <>
        <Kw>await</Kw> That(player.Mock.Verify.Play(<Str>"Let It Be"</Str>)).Once();{'\n'}
        <Kw>await</Kw> That(player.Mock.Verify).AllInteractionsAreVerified();
      </>
    ),
  },
  {
    name: 'Reflection',
    core: true,
    intro: <>Write architecture and convention tests for assemblies, types and members as plain expectations.</>,
    sample: (
      <>
        <Kw>await</Kw> That(In.AssemblyContaining&lt;<Ty>PlaylistService</Ty>&gt;(){'\n'}
        {'        '}.Methods().WhichAreAsync()){'\n'}
        {'    '}.HaveName(<Str>"Async"</Str>).AsSuffix();
      </>
    ),
  },
  {
    name: 'Snapshots',
    core: true,
    intro: (
      <>Compare strings, objects and public APIs with a reviewed snapshot that is stored next to the test.</>
    ),
    sample: (
      <>
        <Kw>await</Kw> That(album).MatchesSnapshot();{'\n'}
        <Kw>await</Kw> That(<Kw>typeof</Kw>(<Ty>Album</Ty>).Assembly).MatchesPublicApiSnapshot();
      </>
    ),
  },
  {
    name: 'Testably',
    family: 'abstractions',
    intro: (
      <>
        Check the files, directories, notifications and timers of the{' '}
        <code>MockFileSystem</code> and <code>MockTimeSystem</code> from Testably.Abstractions.
      </>
    ),
    sample: (
      <>
        <Kw>await</Kw> That(fileSystem).HasFile(<Str>"let-it-be.txt"</Str>){'\n'}
        {'    '}.WithContent(<Str>"let it be"</Str>);
      </>
    ),
  },
  {
    name: 'Web',
    core: true,
    intro: (
      <>
        Check the status code, headers and content of an <code>HttpResponseMessage</code>; a failure shows the whole
        request and response.
      </>
    ),
    sample: (
      <>
        <Kw>await</Kw> That(response).HasStatusCode().Success();{'\n'}
        <Kw>await</Kw> That(response).HasContent(<Str>"*Let It Be*"</Str>).AsWildcard();
      </>
    ),
  },
  {
    name: 'Xml',
    core: true,
    intro: (
      <>
        Compare XML by its content, and check single attributes and child elements of <code>XElement</code> and{' '}
        <code>XDocument</code>.
      </>
    ),
    sample: (
      <>
        <Kw>await</Kw> That(xml).IsEqualTo(expected).AsXml();{'\n'}
        <Kw>await</Kw> That(track).HasAttribute(<Str>"artist"</Str>).EqualTo(<Str>"The Beatles"</Str>);
      </>
    ),
  },
];

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={clsx(styles.container, styles.heroInner)}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Open-source testing libraries for .NET</span>
          <Heading as="h1" className={styles.heroTitle}>
            Tests that read like the sentence you had in mind.
          </Heading>
          <p className={styles.heroLead}>
            Mock the file system and the clock, fake any dependency without reflection, and get failure messages that
            explain themselves. Three libraries, each useful on its own, better together.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#libraries">
              Pick a library
            </a>
            <Link className={styles.secondaryButton} href="https://github.com/Testably">
              View on GitHub
            </Link>
          </div>
          <p className={styles.license}>Free and open source under the MIT license.</p>
        </div>
        <img className={styles.heroLogo} src={useBaseUrl('img/testably-dark.svg')} alt="" width={240} height={240} />
      </div>
    </header>
  );
}

function OneTest() {
  return (
    <section className={styles.section}>
      <div className={clsx(styles.container, styles.stack)}>
        <div className={styles.sectionHead}>
          <Heading as="h2">One test, three libraries</Heading>
          <p>A service that exports a report to disk and notifies the team. No temp folder, no hand-written fake, no guessing what failed.</p>
        </div>
        <pre className={styles.oneTest}>
          <code className={styles.oneTestGrid}>
            <span>
              <Kw>[Test]</Kw>
            </span>
            <span />
            <span>
              <Kw>public async</Kw> <Ty>Task</Ty> Export_WritesReportAndNotifiesTeam()
            </span>
            <span />
            <span>{'{'}</span>
            <span />
            <span>
              {'    '}
              <Ty>MockFileSystem</Ty> fileSystem = <Kw>new</Kw>();
            </span>
            <span className={clsx(styles.lineLabel, styles.abstractions)}>← Testably.Abstractions</span>
            <span>
              {'    '}
              <Ty>INotifier</Ty> notifier = <Ty>INotifier</Ty>.CreateMock();
            </span>
            <span className={clsx(styles.lineLabel, styles.mockolate)}>← Mockolate</span>
            <span>
              {'    '}
              <Ty>ReportService</Ty> sut = <Kw>new</Kw>(fileSystem, notifier);
            </span>
            <span />
            <span> </span>
            <span />
            <span>
              {'    '}
              <Kw>await</Kw> sut.ExportAsync(<Str>"Q3"</Str>);
            </span>
            <span />
            <span> </span>
            <span />
            <span>
              {'    '}
              <Kw>await</Kw> That(fileSystem).HasFile(<Str>"reports/Q3.json"</Str>);
            </span>
            <span className={clsx(styles.lineLabel, styles.awexpect)}>← aweXpect.Testably</span>
            <span>
              {'    '}
              <Kw>await</Kw> That(notifier.Mock.Verify.Send(<Str>"Report Q3 exported"</Str>)).Once();
            </span>
            <span className={clsx(styles.lineLabel, styles.awexpect)}>← aweXpect.Mockolate</span>
            <span>{'}'}</span>
            <span />
          </code>
        </pre>
        <div className={styles.notes}>
          <p>
            <b className={styles.abstractions}>MockFileSystem</b> behaves like the real one on Windows, Linux and
            macOS, all in memory.
          </p>
          <p>
            <b className={styles.mockolate}>CreateMock()</b> is source-generated: a typo in a setup is a compile error.
          </p>
          <p>
            <b className={styles.awexpect}>HasFile(…)</b> reads as a sentence and names the missing path when it fails.
          </p>
        </div>
      </div>
    </section>
  );
}

function LibraryCard({library, versions}: {library: Library; versions: PackageVersions}) {
  const found = versions[library.packageId];
  const prerelease = found?.stable && found.latest !== found.stable ? found.latest : undefined;
  return (
    <Link to={library.href} className={clsx(styles.card, styles[library.key])}>
      <span className={styles.problem}>“{library.problem}”</span>
      <div className={styles.cardHead}>
        <ThemedImage
          sources={{light: useBaseUrl(library.iconLight), dark: useBaseUrl(library.iconDark)}}
          alt=""
          width={44}
          height={44}
        />
        <div>
          <div className={styles.cardTitle}>{library.label}</div>
          <div className={styles.libColor}>{library.tagline}</div>
        </div>
      </div>
      <p className={styles.cardText}>{library.description}</p>
      <pre className={styles.snippet}>
        <code>{library.sample}</code>
      </pre>
      <span className={styles.cardMeta}>
        {found && `v${found.stable ?? found.latest}`}
        {prerelease && ` · v${prerelease} in pre-release`} · {library.platforms}
      </span>
      <span className={clsx(styles.cardLink, styles.libColor)}>Get started with {library.label.replace('Testably.', '')} →</span>
    </Link>
  );
}

function Libraries() {
  const versions = usePluginData('nuget-versions') as PackageVersions;
  return (
    <section id="libraries" className={styles.section}>
      <div className={clsx(styles.container, styles.stack)}>
        <div className={styles.sectionHead}>
          <Heading as="h2">What makes your code hard to test?</Heading>
          <p>Each library removes a different reason to skip a test. Start with the one that matches yours.</p>
        </div>
        <div className={styles.cards}>
          {libraries.map((library) => (
            <LibraryCard key={library.key} library={library} versions={versions} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Extensions() {
  const versions = usePluginData('nuget-versions') as PackageVersions;
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const extension = extensions[selected];
  const packageId = `aweXpect.${extension.name}`;
  const found = versions[packageId];

  function onKeyDown(event: KeyboardEvent) {
    const step = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (step) {
      const next = (selected + step + extensions.length) % extensions.length;
      setSelected(next);
      tabs.current[next]?.focus();
    }
  }

  return (
    <section className={styles.section}>
      <div className={clsx(styles.container, styles.stack)}>
        <Heading as="h2" className={styles.smallHeading}>
          aweXpect extensions
        </Heading>
        <div className={styles.chips} role="tablist" aria-label="aweXpect extensions" onKeyDown={onKeyDown}>
          {extensions.map((e, index) => (
            <button
              key={e.name}
              ref={(tab) => {
                tabs.current[index] = tab;
              }}
              type="button"
              role="tab"
              id={`extension-tab-${e.name}`}
              aria-selected={index === selected}
              aria-controls="extension-panel"
              tabIndex={index === selected ? 0 : -1}
              className={clsx(styles.chip, styles[e.family ?? 'awexpect'], e.core && styles.core)}
              onClick={() => setSelected(index)}
            >
              {e.name}
            </button>
          ))}
        </div>
        <Link
          to={`/aweXpect/extensions/${packageId}/`}
          role="tabpanel"
          id="extension-panel"
          aria-labelledby={`extension-tab-${extension.name}`}
          className={clsx(styles.card, styles.extensionCard, styles[extension.family ?? 'awexpect'])}
        >
          <div className={styles.extensionTitle}>
            <span className={styles.cardTitle}>{packageId}</span>
            {found && <span className={styles.cardMeta}>v{found.stable ?? found.latest}</span>}
          </div>
          <p className={styles.cardText}>{extension.intro}</p>
          <pre className={styles.snippet}>
            <code>{extension.sample}</code>
          </pre>
          <span className={clsx(styles.cardLink, styles.libColor)}>Read the {packageId} docs →</span>
        </Link>
        <p className={styles.muted}>
          Testably and Mockolate bridge the family: assertions on a <code>MockFileSystem</code> and on Mockolate
          interactions.
        </p>
        <p className={styles.muted}>
          Writing durations? <Link to="/aweXpect/chronology/">aweXpect.Chronology</Link> turns{' '}
          <code>5.Seconds()</code> and <code>24.December(2024)</code> into <code>TimeSpan</code> and{' '}
          <code>DateTime</code> values, no aweXpect needed.
        </p>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Documentation for the Testably family of testing libraries: Testably.Abstractions, aweXpect and Mockolate."
    >
      <Hero />
      <main>
        <OneTest />
        <Libraries />
        <Extensions />
      </main>
    </Layout>
  );
}
