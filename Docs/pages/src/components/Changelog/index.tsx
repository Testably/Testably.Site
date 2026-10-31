/**
 * The changelog of a library as release cards, filled from the `changelog.json` that the Pages build generates
 * from the GitHub releases next to the page. The latest major version is expanded, older ones on demand.
 */
import React, {type ReactElement, type ReactNode, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type Category = 'breaking' | 'feature' | 'fix' | 'performance';

type ChangelogItem = {category: Category; text: string; number: number; url: string};

type ChangelogRelease = {version: string; date: string; prerelease: boolean; url: string; items: ChangelogItem[]};

type Props = {releases: ChangelogRelease[]};

const categories: {category: Category; label: string}[] = [
  {category: 'breaking', label: 'Breaking'},
  {category: 'feature', label: 'Feature'},
  {category: 'fix', label: 'Fix'},
  {category: 'performance', label: 'Performance'},
];

function renderText(text: string): ReactNode[] {
  return text.split('`').map((segment, index) => (index % 2 === 1 ? <code key={index}>{segment}</code> : segment));
}

function ReleaseCard({release, filter}: {release: ChangelogRelease; filter: Category | null}): ReactElement | null {
  const items = release.items.filter((item) => filter === null || item.category === filter);
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={clsx('card', styles.release)}>
      <div className={clsx('card__header', styles.header)}>
        <a className={styles.version} href={release.url}>{release.version}</a>
        {release.prerelease && <span className="badge badge--secondary">pre-release</span>}
        <span className={styles.date}>{release.date}</span>
      </div>
      <ul className={clsx('card__body', styles.items)}>
        {items.map((item) => {
          const category = categories.find((c) => c.category === item.category)!;
          return (
            <li key={item.number}>
              <span className={clsx(styles.label, styles[category.category])}>{category.label}</span>
              <span>
                {renderText(item.text)} <a href={item.url}>#{item.number}</a>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Changelog({releases}: Props): ReactElement {
  const [filter, setFilter] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const majors = [...new Set(releases.map((release) => release.version.split('.')[0]))];

  return (
    <>
      <div className={styles.filters}>
        {[{category: null, label: 'All'}, ...categories].map(({category, label}) => (
          <button
            key={label}
            type="button"
            className={clsx('button button--sm button--outline button--primary', filter === category && 'button--active')}
            onClick={() => setFilter(category)}>
            {label}
          </button>
        ))}
      </div>
      {majors.map((major, index) => {
        const majorReleases = releases.filter((release) => release.version.split('.')[0] === major);
        const isExpanded = index === 0 || expanded.includes(major);
        return (
          <section key={major}>
            <h2 id={`version-${major}`}>Version {major}</h2>
            {isExpanded ? (
              majorReleases.map((release) => <ReleaseCard key={release.version} release={release} filter={filter} />)
            ) : (
              <button
                type="button"
                className="button button--sm button--secondary"
                onClick={() => setExpanded([...expanded, major])}>
                Show {majorReleases.length} releases
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}
