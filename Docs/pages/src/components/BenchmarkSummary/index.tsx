/**
 * Summarises the latest aweXpect benchmark snapshot in one tile per other library:
 * its version and the median factor by which it is slower or allocates more than
 * aweXpect. Reads the same `src/data/awexpect/benchmarks.json` as `BenchmarkResult`.
 */
import React, {type ReactElement} from 'react';
import benchmarks from '@site/src/data/awexpect/benchmarks.json';
import styles from './styles.module.css';

type Sample = {
  timeNs: number;
  memoryBytes?: number;
};

type BenchmarkEntry = {
  aweXpect: Sample;
  FluentAssertions: Sample;
  TUnit?: Sample;
};

const data = benchmarks as {benchmarks: Record<string, BenchmarkEntry>; versions?: Record<string, string>};
const entries = Object.values(data.benchmarks);

const OTHER_LIBRARIES = [
  {name: 'FluentAssertions', accent: '#ff671b'},
  {name: 'TUnit', accent: '#7e57c2'},
] as const;

const METRICS = [
  {key: 'timeNs', worse: 'slower', better: 'faster'},
  {key: 'memoryBytes', worse: 'more memory', better: 'less memory'},
] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function ratiosOf(library: (typeof OTHER_LIBRARIES)[number]['name'], metric: (typeof METRICS)[number]): number[] {
  return entries.flatMap((entry) => {
    const awe = entry.aweXpect[metric.key];
    const other = entry[library]?.[metric.key];
    if (awe === undefined || other === undefined) return [];
    if (awe === other) return [1];
    return [awe === 0 ? Infinity : other / awe];
  });
}

export default function BenchmarkSummary(): ReactElement {
  return (
    <div className={styles.tiles}>
      {OTHER_LIBRARIES.map((library) => {
        const version = data.versions?.[library.name];
        const count = ratiosOf(library.name, METRICS[0]).length;
        return (
          <div key={library.name} className={styles.tile} style={{borderTopColor: library.accent}}>
            <div className={styles.title}>
              {library.name}
              {version && <span className={styles.muted}> v{version}</span>}
            </div>
            {METRICS.map((metric) => {
              const ratios = ratiosOf(library.name, metric);
              if (ratios.length === 0) return null;
              const factor = median(ratios);
              return (
                <div key={metric.key} className={styles.row}>
                  <span className={styles.factor}>{(factor >= 1 ? factor : 1 / factor).toFixed(1)}×</span>
                  <span>{factor >= 1 ? metric.worse : metric.better}</span>
                </div>
              );
            })}
            <div className={styles.muted}>median of {count} benchmarks</div>
          </div>
        );
      })}
    </div>
  );
}
