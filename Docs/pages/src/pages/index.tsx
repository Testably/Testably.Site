import {useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {usePluginData} from '@docusaurus/useGlobalData';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Admonition from '@theme/Admonition';
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
        Compare JSON strings by their structure, so whitespace and property order no longer break a test. Check single
        properties of a <code>JsonElement</code> or <code>JsonNode</code>, or match JSON against an anonymous object. A
        failure names the path of the first difference, e.g. <code>$.durationSeconds</code>.
      </>
    ),
    sample: (
      <>
        <Ty>string</Ty> json = <Str>{'"""{"title": "Let It Be", "year": 1970}"""'}</Str>;{'\n'}
        {'\n'}
        <Cm>// equal, although formatted differently</Cm>
        {'\n'}
        <Kw>await</Kw> That(json).IsEqualTo(<Str>{'"""{ "year": 1970, "title": "Let It Be" }"""'}</Str>).AsJson();{'\n'}
        <Cm>// only checks the properties you care about</Cm>
        {'\n'}
        <Kw>await</Kw> That(json).IsValidJsonMatching(<Kw>new</Kw> {'{'} title = <Str>"Let It Be"</Str> {'}'});
      </>
    ),
  },
  {
    name: 'Logging',
    intro: (
      <>
        Verify what your code logged with <code>Microsoft.Extensions.Logging</code>. Collect the records with a{' '}
        <code>FakeLogger</code> and check their level, message, exception and properties. A failure lists the records
        that were actually logged.
      </>
    ),
    sample: (
      <>
        <Ty>FakeLogger</Ty>&lt;<Ty>OrderService</Ty>&gt; logger = <Kw>new</Kw>();{'\n'}
        <Kw>new</Kw> <Ty>OrderService</Ty>(logger).Submit(order);{'\n'}
        {'\n'}
        <Kw>await</Kw> That(logger).LoggedWarning(){'\n'}
        {'    '}.WithMessage(<Str>"Retry limit * reached"</Str>).AsWildcard();{'\n'}
        <Kw>await</Kw> That(logger).DidNotLogError();
      </>
    ),
  },
  {
    name: 'Mockolate',
    family: 'mockolate',
    intro: (
      <>
        Verify the interactions with a Mockolate mock as regular aweXpect expectations: how often a method was called,
        in which order, and that no call went unchecked. A failure lists all recorded interactions.
      </>
    ),
    sample: (
      <>
        <Ty>IPlayer</Ty> player = <Ty>IPlayer</Ty>.CreateMock();{'\n'}
        <Kw>new</Kw> <Ty>Jukebox</Ty>(player).PlayOnce(<Str>"Let It Be"</Str>);{'\n'}
        {'\n'}
        <Kw>await</Kw> That(player.Mock.Verify.Play(<Str>"Let It Be"</Str>)).Once();{'\n'}
        <Kw>await</Kw> That(player.Mock.Verify.Play(<Str>"Let It Be"</Str>)).Then(m =&gt; m.Stop());{'\n'}
        <Kw>await</Kw> That(player.Mock.Verify).AllInteractionsAreVerified();
      </>
    ),
  },
  {
    name: 'Reflection',
    core: true,
    intro: (
      <>
        Guard your architecture and naming conventions with tests. Select assemblies, types or members, filter them, and
        state a rule, e.g. which layer must not reference which. A failure names every type or member that breaks the
        rule.
      </>
    ),
    sample: (
      <>
        <Cm>// the API layer must not reference the data layer</Cm>
        {'\n'}
        <Kw>await</Kw> That(Types.InNamespace(<Str>"MusicStore.Api"</Str>)){'\n'}
        {'    '}.DoNotDependOn(<Str>"MusicStore.Data"</Str>);{'\n'}
        {'\n'}
        <Cm>// every async method ends in "Async"</Cm>
        {'\n'}
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
      <>
        Verify large or generated output without writing out the expected value. The first run stores the result in a
        file next to the test; once you accepted it, later runs fail as soon as the output changes. It also catches
        unintended changes to the public API of an assembly.
      </>
    ),
    sample: (
      <>
        <Cm>// compared with AlbumTests.Describes.awexpect-snapshot.txt</Cm>
        {'\n'}
        <Kw>await</Kw> That(album).MatchesSnapshot();{'\n'}
        {'\n'}
        <Cm>// fails when a public type or member was added, changed or removed</Cm>
        {'\n'}
        <Kw>await</Kw> That(<Kw>typeof</Kw>(<Ty>Album</Ty>).Assembly).MatchesPublicApiSnapshot();
      </>
    ),
  },
  {
    name: 'Testably',
    family: 'abstractions',
    intro: (
      <>
        Verify the state of the <code>MockFileSystem</code> and <code>MockTimeSystem</code> from Testably.Abstractions
        after your code ran: which files and directories exist, what they contain, and which timers and notifications
        were triggered.
      </>
    ),
    sample: (
      <>
        <Ty>MockFileSystem</Ty> fileSystem = <Kw>new</Kw>();{'\n'}
        <Ty>MockTimeSystem</Ty> timeSystem = <Kw>new</Kw>();{'\n'}
        <Kw>new</Kw> <Ty>AutoSaver</Ty>(fileSystem, timeSystem).Start(<Str>"Let It Be"</Str>);{'\n'}
        {'\n'}
        <Kw>await</Kw> That(fileSystem).HasFile(<Str>"let-it-be.txt"</Str>){'\n'}
        {'    '}.WithContent(<Str>"let it be"</Str>).IgnoringCase();{'\n'}
        <Kw>await</Kw> That(timeSystem.TimerHandler[<Str>0</Str>]){'\n'}
        {'    '}.Executed().AtLeast(<Str>3</Str>.Times()).Within(<Str>5</Str>.Seconds());
      </>
    ),
  },
  {
    name: 'Web',
    core: true,
    intro: (
      <>
        Verify HTTP requests and responses, e.g. in integration tests with an <code>HttpClient</code>: status code,
        headers, content and problem details. A failure shows the whole request and response, so you see what the server
        actually returned.
      </>
    ),
    sample: (
      <>
        <Ty>HttpResponseMessage</Ty> response = <Kw>await</Kw> client.GetAsync(<Str>"/tracks/1"</Str>);{'\n'}
        {'\n'}
        <Kw>await</Kw> That(response).HasStatusCode().Success();{'\n'}
        <Kw>await</Kw> That(response).HasContentType(<Str>"application/json"</Str>);{'\n'}
        <Kw>await</Kw> That(response).HasContent(<Str>"*Let It Be*"</Str>).AsWildcard();
      </>
    ),
  },
  {
    name: 'Xml',
    core: true,
    intro: (
      <>
        Compare XML by its content, so attribute order, whitespace and comments no longer break a test. Check single
        attributes and child elements of an <code>XElement</code> or <code>XDocument</code>. A failure names the path of
        the difference, e.g. <code>/album/track/@title</code>.
      </>
    ),
    sample: (
      <>
        <Ty>string</Ty> xml = <Str>{'"""<track title="Let It Be" artist="The Beatles"/>"""'}</Str>;{'\n'}
        {'\n'}
        <Cm>// equal, although the attributes are in a different order</Cm>
        {'\n'}
        <Kw>await</Kw> That(xml).IsEqualTo(<Str>{'"""<track artist="The Beatles" title="Let It Be"/>"""'}</Str>){'\n'}
        {'    '}.AsXml();
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
          width={53}
          height={53}
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
              className={clsx(styles.chip, styles[e.family ?? 'awexpect'], e.core ? styles.core : styles.separate)}
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
        <Admonition type="tip">
          Use <Link to="/aweXpect/chronology/">aweXpect.Chronology</Link> to write durations and dates as{' '}
          <code>5.Seconds()</code> or <code>24.December(2024)</code> instead of <code>TimeSpan.FromSeconds(5)</code>{' '}
          or <code>new DateTime(2024, 12, 24)</code>. It works on its own, also without aweXpect.
        </Admonition>
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
