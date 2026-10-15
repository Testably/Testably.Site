/**
 * Renders the latest aweXpect vs FluentAssertions and TUnit snapshot for a single
 * benchmark name (e.g. "Bool", "String", "Int_GreaterThan"). Reads from
 * `src/data/awexpect/benchmarks.json` — refreshed at deploy time by
 * Testably.Server's docs pipeline (the `Benchmarks` Fallout target) from the
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

/**
 * Worded as "1.10× as long" rather than "1.10× slower", which could just as well be read as 110% slower.
 */
const WORDING = {
  timeNs: {verb: 'takes', amount: 'as long', more: 'longer'},
  memoryBytes: {verb: 'allocates', amount: 'as much', more: 'more'},
};

function formatDelta(
  awe: number,
  other: number,
  metric: Metric,
  name: string,
): {text: string; title: string; better: boolean} {
  // The delta describes the other library's row, so lower is better for it.
  // aweXpect can report 0 B for allocation benchmarks, so other / awe needs an
  // explicit zero-baseline case instead of dividing by zero.
  const {verb, amount, more} = WORDING[metric];
  if (awe === other) return {text: '±0%', title: `${name} ${verb} ${amount} as aweXpect`, better: true};
  if (awe === 0) return {text: '+∞', title: `${name} ${verb} ${more} than aweXpect`, better: false};
  const pct = (other / awe - 1) * 100;
  const better = pct < 0;
  const arrow = better ? '−' : '+';
  return {
    text: `${arrow}${Math.abs(pct).toFixed(0)}%`,
    title: `${name} ${verb} ${(other / awe).toFixed(2)}× ${amount} as aweXpect`,
    better,
  };
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 16;
const SPARK_PADDING = 2;

/**
 * The ratio of the other library to aweXpect for each run, aligned from the newest run, because
 * a library that was added later has a shorter history.
 */
function ratioHistory(awe: number[] | undefined, other: number[] | undefined): number[] {
  if (!awe || !other) return [];
  const count = Math.min(awe.length, other.length);
  return Array.from({length: count}, (_, i) => {
    const aweValue = awe[awe.length - count + i];
    const otherValue = other[other.length - count + i];
    return aweValue === otherValue ? 1 : otherValue / aweValue;
  }).filter(Number.isFinite);
}

type SparklineProps = {
  values: number[];
  className: string;
  title: string;
};

function Sparkline({values, className, title}: SparklineProps): ReactElement | null {
  if (values.length < 2) return null;

  // Parity is always in range, so a stable ratio stays flat instead of stretching noise to full height.
  const min = Math.min(1, ...values);
  const max = Math.max(1, ...values);
  const range = max - min;
  const innerHeight = SPARK_HEIGHT - SPARK_PADDING * 2;
  const toY = (v: number): number => SPARK_PADDING + innerHeight - ((v - min) / range) * innerHeight;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * SPARK_WIDTH;
    const y = range === 0 ? SPARK_HEIGHT / 2 : toY(v);
    return [x, y] as const;
  });
  const parityY = range === 0 ? SPARK_HEIGHT / 2 : toY(1);

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
      <title>{title}</title>
      <line
        x1={0}
        y1={parityY}
        x2={SPARK_WIDTH}
        y2={parityY}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
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
    return value === undefined ? [] : [{
      ...library,
      value,
      ratios: ratioHistory(entry.aweXpect.history?.[metric], entry[library.name]?.history?.[metric]),
    }];
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
        </div>
        {others.map((other) => {
          const delta = formatDelta(aweXpectValue, other.value, metric, other.name);
          return (
            <div className={styles.barRow} key={other.name}>
              <span className={styles.libraryLabel}>{other.name}</span>
              <span className={styles.bar}>
                <span className={other.fill} style={{width: width(other.value)}} />
              </span>
              <span className={styles.barValue}>{format(other.value)}</span>
              <Sparkline
                values={other.ratios}
                className={`${styles.sparkline} ${other.sparkline}`}
                title={`${other.name} compared to aweXpect over the last ${other.ratios.length} runs (dashed line: equal)`}
              />
              <span
                className={delta.better ? styles.delta : `${styles.delta} ${styles.deltaWorse}`}
                title={delta.title}>
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
