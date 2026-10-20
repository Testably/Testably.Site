/**
 * Summarises the latest benchmark snapshot of a package (`aweXpect` by default) in one tile per other library:
 * its version and the median factor of its time and memory relative to aweXpect,
 * worded as "as long" so that 1.1× cannot be misread as 110% slower. Reads the same data as `BenchmarkResult`.
 */
import React, {type ReactElement} from 'react';
import benchmarksByPackage from '@site/src/data/awexpect';
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

type Snapshot = {benchmarks: Record<string, BenchmarkEntry>; versions?: Record<string, string>};

const OTHER_LIBRARIES = [
  {name: 'FluentAssertions', accent: '#ff671b'},
  {name: 'TUnit', accent: '#7e57c2'},
] as const;

const METRICS = [
  {key: 'timeNs', label: 'as long'},
  {key: 'memoryBytes', label: 'as much memory'},
] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function ratiosOf(
  entries: BenchmarkEntry[],
  library: (typeof OTHER_LIBRARIES)[number]['name'],
  metric: (typeof METRICS)[number],
): number[] {
  return entries.flatMap((entry) => {
    const awe = entry.aweXpect[metric.key];
    const other = entry[library]?.[metric.key];
    if (awe === undefined || other === undefined) return [];
    if (awe === other) return [1];
    return [awe === 0 ? Infinity : other / awe];
  });
}

type Props = {
  package?: string;
};

// `package` is a reserved word in strict mode, so it cannot be destructured under its own name.
export default function BenchmarkSummary({package: packageName = 'aweXpect'}: Props): ReactElement | null {
  const data = benchmarksByPackage[packageName] as Snapshot | undefined;
  if (!data) return null;
  const entries = Object.values(data.benchmarks);
  return (
    <div className={styles.tiles}>
      {OTHER_LIBRARIES.map((library) => {
        const version = data.versions?.[library.name];
        const count = ratiosOf(entries, library.name, METRICS[0]).length;
        // The extension packages are only compared with FluentAssertions.
        if (count === 0) return null;
        return (
          <div key={library.name} className={styles.tile} style={{borderTopColor: library.accent}}>
            <div className={styles.title}>
              {library.name}
              {version && <span className={styles.muted}> v{version}</span>}
            </div>
            {METRICS.map((metric) => {
              const ratios = ratiosOf(entries, library.name, metric);
              if (ratios.length === 0) return null;
              const factor = median(ratios);
              return (
                <div key={metric.key} className={styles.row}>
                  <span className={styles.factor}>{factor.toFixed(1)}×</span>
                  <span>{metric.label}</span>
                </div>
              );
            })}
            <div className={styles.muted}>relative to aweXpect · median of {count} benchmarks</div>
          </div>
        );
      })}
    </div>
  );
}
