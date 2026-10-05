/**
 * Renders the latest aweXpect vs FluentAssertions and TUnit snapshot for a single
 * benchmark name (e.g. "Bool", "String", "Int_GreaterThan"). Reads from
 * `src/data/awexpect/benchmarks.json` — refreshed at deploy time by
 * Testably.Server's docs pipeline (the `Benchmarks` Nuke target) from the
 * `Testably/aweXpect` benchmarks branch. The committed file doubles as a
 * fallback so `npm start`/`npm run build` work in a clean checkout.
 */
import React, {type ReactElement} from 'react';
import benchmarks from '@site/src/data/awexpect/benchmarks.json';
import styles from './styles.module.css';

type Sample = {
  timeNs: number;
  memoryBytes?: number;
  history?: {
    timeNs: number[];
    memoryBytes: number[];
  };
};

type BenchmarkEntry = {
  aweXpect: Sample;
  FluentAssertions: Sample;
  TUnit?: Sample;
};

type Snapshot = {
  capturedAt: {
    sha: string;
    shortSha: string;
    date: string;
    message?: string;
  };
  environment?: {
    runner?: string;
    toolchain?: string;
  };
  benchmarks: Record<string, BenchmarkEntry>;
};

const data = benchmarks as Snapshot;

function formatNs(ns: number): string {
  if (ns < 1_000) return `${ns.toFixed(1)} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)} µs`;
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

function formatBytes(b: number): string {
  if (b < 1_024) return `${b} B`;
  if (b < 1_024 * 1_024) return `${(b / 1_024).toFixed(2)} KiB`;
  return `${(b / (1_024 * 1_024)).toFixed(2)} MiB`;
}

function formatDelta(awe: number, other: number): {text: string; better: boolean} {
  // Lower is better for both metrics. Handle the zero-baseline cases explicitly:
  // FluentAssertions reports 0 B for many allocation benchmarks, so a naive
  // awe / other would divide by zero and a "ratio === 1" fallback would silently
  // hide regressions where aweXpect allocates and the other library does not.
  if (other === 0) {
    if (awe === 0) return {text: '±0%', better: true};
    return {text: '+∞', better: false};
  }
  if (awe === other) return {text: '±0%', better: true};
  const ratio = awe / other;
  const pct = Math.abs(ratio - 1) * 100;
  const better = ratio < 1;
  const arrow = better ? '−' : '+';
  return {text: `${arrow}${pct.toFixed(0)}%`, better};
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 16;
const SPARK_PADDING = 2;

type SparklineProps = {
  values: number[] | undefined;
  className: string;
};

function Sparkline({values, className}: SparklineProps): ReactElement | null {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const innerHeight = SPARK_HEIGHT - SPARK_PADDING * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * SPARK_WIDTH;
    const y = range === 0
      ? SPARK_HEIGHT / 2
      : SPARK_PADDING + innerHeight - ((v - min) / range) * innerHeight;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      className={className}
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="1.6" fill="currentColor" />
    </svg>
  );
}

type Metric = 'timeNs' | 'memoryBytes';

const OTHER_LIBRARIES = [
  {name: 'FluentAssertions', fill: styles.barFillFluentAssertions, sparkline: styles.sparklineFluentAssertions},
  {name: 'TUnit', fill: styles.barFillTUnit, sparkline: styles.sparklineTUnit},
] as const;

type MetricRowProps = {
  label: string;
  entry: BenchmarkEntry;
  metric: Metric;
  format: (n: number) => string;
};

function MetricRow({label, entry, metric, format}: MetricRowProps): ReactElement | null {
  const aweXpectValue = entry.aweXpect[metric];
  if (aweXpectValue === undefined) return null;

  // Not every benchmark has a counterpart in every library.
  const others = OTHER_LIBRARIES.flatMap((library) => {
    const value = entry[library.name]?.[metric];
    return value === undefined ? [] : [{...library, value, history: entry[library.name]?.history?.[metric]}];
  });
  const max = Math.max(aweXpectValue, ...others.map((other) => other.value));
  const width = (value: number): string => `${max === 0 ? 0 : (value / max) * 100}%`;

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.bars}>
        <div className={styles.barRow}>
          <span className={styles.libraryLabel}>aweXpect</span>
          <span className={styles.bar}>
            <span className={styles.barFillPrimary} style={{width: width(aweXpectValue)}} />
          </span>
          <span className={styles.barValue}>{format(aweXpectValue)}</span>
          <Sparkline
            values={entry.aweXpect.history?.[metric]}
            className={`${styles.sparkline} ${styles.sparklineAwexpect}`}
          />
        </div>
        {others.map((other) => {
          const delta = formatDelta(aweXpectValue, other.value);
          return (
            <div className={styles.barRow} key={other.name}>
              <span className={styles.libraryLabel}>{other.name}</span>
              <span className={styles.bar}>
                <span className={other.fill} style={{width: width(other.value)}} />
              </span>
              <span className={styles.barValue}>{format(other.value)}</span>
              <Sparkline values={other.history} className={`${styles.sparkline} ${other.sparkline}`} />
              <span
                className={delta.better ? styles.delta : `${styles.delta} ${styles.deltaWorse}`}
                title={`aweXpect compared to ${other.name}`}>
                {delta.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  name: string;
};

export default function BenchmarkResult({name}: Props): ReactElement {
  const entry = data.benchmarks[name];
  if (!entry) {
    return (
      <div className={styles.error}>
        No benchmark data for <code>{name}</code>.
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <MetricRow label="Time" entry={entry} metric="timeNs" format={formatNs} />
      <MetricRow label="Memory" entry={entry} metric="memoryBytes" format={formatBytes} />

      <div className={styles.caption}>
        Captured on commit{' '}
        <a
          href={`https://github.com/Testably/aweXpect/commit/${data.capturedAt.sha}`}
          target="_blank"
          rel="noreferrer"
          title={data.capturedAt.message}>
          <code>{data.capturedAt.shortSha}</code>
        </a>{' '}
        ({data.capturedAt.date})
        {data.environment?.runner ? ` on ${data.environment.runner}` : ''}.
      </div>
    </div>
  );
}
