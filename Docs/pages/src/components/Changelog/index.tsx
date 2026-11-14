/**
 * The changelog of a library as a timeline, filled from the `*.changelog.json` that the Pages build generates from
 * the GitHub releases next to the page. Each major version is a chapter with a summary and its upgrade guide; the
 * releases of the latest major version are shown, older ones on demand.
 */
import React, {type ReactElement, type ReactNode, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

type Category = 'breaking' | 'feature' | 'fix' | 'performance';

type ChangelogItem = {category: Category; text: string; number: number; url: string};

type ChangelogRelease = {
  version: string;
  date: string;
  prerelease: boolean;
  url: string;
  commits: number;
  items: ChangelogItem[];
};

type MigrationGuide = {major: number; url: string; title: string};

type MergedPackage = {major: number; name: string; url: string; lastVersion: string | null};

type Props = {
  changelog: {migrationGuides: MigrationGuide[]; mergedPackages: MergedPackage[]; releases: ChangelogRelease[]};
};

type Summary = {commits: number; counts: Record<Category, number>};

const categories: {category: Category; label: string; one: string; many: string}[] = [
  {category: 'breaking', label: 'Breaking changes', one: 'breaking change', many: 'breaking changes'},
  {category: 'feature', label: 'Features', one: 'feature', many: 'features'},
  {category: 'fix', label: 'Fixes', one: 'fix', many: 'fixes'},
  {category: 'performance', label: 'Performance', one: 'performance improvement', many: 'performance improvements'},
];

// Some tags name a package before the version (e.g. `core/v0.19.0`).
const majorOf = (release: ChangelogRelease): number => parseInt(release.version.match(/\d+/)?.[0] ?? '0', 10);

const formatDate = (date: string, options: Intl.DateTimeFormatOptions): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {...options, timeZone: 'UTC'});

const plural = (count: number, one: string, many: string): string =>
  `${count.toLocaleString('en')} ${count === 1 ? one : many}`;

function renderText(text: string): ReactNode[] {
  return text.split('`').map((segment, index) => (index % 2 === 1 ? <code key={index}>{segment}</code> : segment));
}

function summarize(releases: ChangelogRelease[]): Summary {
  const counts: Record<Category, number> = {breaking: 0, feature: 0, fix: 0, performance: 0};
  let commits = 0;
  for (const release of releases) {
    commits += release.commits;
    for (const item of release.items) {
      counts[item.category]++;
    }
  }
  return {commits, counts};
}

function Bar({summary}: {summary: Summary}): ReactElement {
  const present = categories.filter(({category}) => summary.counts[category] > 0);
  const total = present.reduce((sum, {category}) => sum + summary.counts[category], 0);
  return (
    <div
      className={styles.bar}
      role="img"
      aria-label={present.map(({category, many}) => `${summary.counts[category]} ${many}`).join(', ')}>
      {present.map(({category}) => (
        <span key={category} className={styles[category]} style={{width: `${(100 * summary.counts[category]) / total}%`}} />
      ))}
    </div>
  );
}

function Stats({summary}: {summary: Summary}): ReactElement {
  return (
    <div className={styles.stats}>
      {summary.commits > 0 && (
        <span>
          <b>{summary.commits.toLocaleString('en')}</b> {summary.commits === 1 ? 'commit' : 'commits'}
        </span>
      )}
      {categories
        .filter(({category}) => summary.counts[category] > 0)
        .map(({category, one, many}) => (
          <span key={category} className={clsx(category === 'breaking' && styles.breakingText)}>
            <b>{summary.counts[category].toLocaleString('en')}</b> {summary.counts[category] === 1 ? one : many}
          </span>
        ))}
    </div>
  );
}

function MigrationLink({guide, upcoming}: {guide: MigrationGuide; upcoming?: boolean}): ReactElement {
  return (
    <div className={clsx(styles.migration, upcoming && styles.upcoming)}>
      <strong>{upcoming ? `Preparing v${guide.major}…` : `Upgrading from v${guide.major - 1}?`}</strong>
      <Link to={guide.url}>{guide.title}</Link>
    </div>
  );
}

function Release({release, latest}: {release: ChangelogRelease; latest: boolean}): ReactElement {
  const summary = summarize([release]);
  return (
    <>
      <div className={styles.when}>
        <b>{formatDate(release.date, {month: 'short', day: 'numeric'})}</b> {release.date.substring(0, 4)}
      </div>
      <div className={styles.body}>
        <span className={clsx(styles.dot, summary.counts.breaking > 0 && styles.breakingDot)} aria-hidden="true" />
        <div className={styles.head}>
          <a className={styles.version} href={release.url}>{release.version}</a>
          {latest && <span className={clsx(styles.badge, styles.latest)}>Latest</span>}
          {release.prerelease && <span className={styles.badge}>Pre-release</span>}
          {summary.counts.breaking > 0 && (
            <span className={clsx(styles.badge, styles.breakingBadge)}>{summary.counts.breaking} breaking</span>
          )}
        </div>
        {release.items.length > 0 && <Bar summary={summary} />}
        <Stats summary={summary} />
        {release.items.length === 0 ? (
          <p className={styles.span}>No user-facing changes</p>
        ) : (
          <details className={styles.changes} open={latest}>
            <summary>{plural(release.items.length, 'change', 'changes')}</summary>
            {categories.map(({category, label}) => {
              const items = release.items.filter((item) => item.category === category);
              return items.length === 0 ? null : (
                <div key={category}>
                  <div className={clsx(styles.group, styles[`${category}Text`])}>{label} · {items.length}</div>
                  <ul className={styles.items}>
                    {items.map((item) => (
                      <li key={item.number}>
                        {renderText(item.text)} <a href={item.url}>#{item.number}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </details>
        )}
      </div>
    </>
  );
}

/**
 * The packages that are released together with the library from this major version on, with links to the changelogs
 * of their earlier releases. They are placed below the first release of the major version (the oldest one, as the
 * releases are listed newest first), where they joined; an upcoming major version without releases shows them below
 * its summary.
 */
function MergedPackages({major, packages}: {major: number; packages: MergedPackage[]}): ReactElement | null {
  if (packages.length === 0) {
    return null;
  }
  return (
    <>
      <div className={styles.when} />
      <div className={styles.body}>
        <span className={clsx(styles.dot, styles.mergedDot)} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.version}>{plural(packages.length, 'package', 'packages')} joined</span>
        </div>
        <p className={styles.span}>
          From version {major} on, these packages are released together with this library. Their earlier releases
          have their own changelogs:
        </p>
        <ul className={styles.items}>
          {packages.map((mergedPackage) => (
            <li key={mergedPackage.name}>
              <Link to={mergedPackage.url}>{mergedPackage.name}</Link>
              {mergedPackage.lastVersion && ` · changes up to ${mergedPackage.lastVersion}`}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function Changelog({changelog: {migrationGuides, mergedPackages, releases}}: Props): ReactElement {
  const [expanded, setExpanded] = useState<number[]>([]);
  const majors = [...new Set(releases.map(majorOf))];
  const upcoming = migrationGuides.filter((guide) => majors.length === 0 || guide.major > majors[0]);

  return (
    <>
      <div className={styles.legend}>
        {categories.map(({category, label}) => (
          <span key={category} className={styles[`${category}Text`]}>{label}</span>
        ))}
      </div>
      <div className={styles.timeline}>
        {upcoming.map((guide) => (
          <React.Fragment key={guide.major}>
            <div className={clsx(styles.when, styles.chapterWhen)}>upcoming</div>
            <div className={clsx(styles.body, styles.chapter)}>
              <span className={clsx(styles.medal, styles.upcomingMedal)} aria-hidden="true">v{guide.major}</span>
              <h2 id={`version-${guide.major}`}>
                Version {guide.major} <span className={clsx(styles.badge, styles.upcomingBadge)}>Upcoming</span>
              </h2>
              <MigrationLink guide={guide} upcoming />
            </div>
            <MergedPackages major={guide.major} packages={mergedPackages.filter((p) => p.major === guide.major)} />
          </React.Fragment>
        ))}
        {majors.map((major, index) => {
          const majorReleases = releases.filter((release) => majorOf(release) === major);
          const first = majorReleases[majorReleases.length - 1];
          const last = majorReleases[0];
          const guide = migrationGuides.find((migrationGuide) => migrationGuide.major === major);
          const from = formatDate(first.date, {month: 'short', year: 'numeric'});
          const to = formatDate(last.date, {month: 'short', year: 'numeric'});
          return (
            <React.Fragment key={major}>
              <div className={clsx(styles.when, styles.chapterWhen)}>{last.date.substring(0, 4)}</div>
              <div className={clsx(styles.body, styles.chapter)}>
                <span className={styles.medal} aria-hidden="true">v{major}</span>
                <h2 id={`version-${major}`}>Version {major}</h2>
                <p className={styles.span}>
                  {plural(majorReleases.length, 'release', 'releases')} · {from === to ? from : `${from} to ${to}`}
                </p>
                {guide && <MigrationLink guide={guide} />}
              </div>
              {index === 0 || expanded.includes(major) ? (
                <>
                  {majorReleases.map((release) => (
                    <Release key={release.version} release={release} latest={release === releases[0]} />
                  ))}
                  <MergedPackages major={major} packages={mergedPackages.filter((p) => p.major === major)} />
                </>
              ) : (
                <>
                  <div className={styles.when} />
                  <div className={clsx(styles.body, styles.fold)}>
                    <button type="button" className={styles.show} onClick={() => setExpanded([...expanded, major])}>
                      Show {plural(majorReleases.length, 'release', 'releases')} of version {major}
                    </button>
                  </div>
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
