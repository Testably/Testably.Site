/**
 * Renders the latest aweXpect vs FluentAssertions snapshot for a single
 * benchmark name (e.g. "Bool", "String", "Int_GreaterThan"). Reads from
 * `src/data/awexpect/benchmarks.json` — eventually written by Testably.Server's
 * docs build pipeline after fetching the latest values from the
 * `aweXpect/aweXpect` benchmarks branch.
 */
import React, {type ReactElement} from 'react';
import benchmarks from '@site/src/data/awexpect/benchmarks.json';
import styles from './styles.module.css';

type Sample = {
  timeNs: number;
  memoryBytes: number;
  history?: {
    timeNs: number[];
    memoryBytes: number[];
  };
};

type BenchmarkEntry = {
  aweXpect: Sample;
  FluentAssertions: Sample;
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

function formatDelta(ratio: number): {text: string; better: boolean} {
  // ratio = aweXpect / FluentAssertions; lower is better for both metrics here.
  if (ratio === 1) return {text: '±0%', better: true};
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

type MetricRowProps = {
  label: string;
  aweXpectValue: number;
  faValue: number;
  aweXpectHistory?: number[];
  faHistory?: number[];
  format: (n: number) => string;
};

function MetricRow({
  label,
  aweXpectValue,
  faValue,
  aweXpectHistory,
  faHistory,
  format,
}: MetricRowProps): ReactElement {
  const max = Math.max(aweXpectValue, faValue);
  const aweXpectWidth = max === 0 ? 0 : (aweXpectValue / max) * 100;
  const faWidth = max === 0 ? 0 : (faValue / max) * 100;
  const delta = formatDelta(faValue === 0 ? 1 : aweXpectValue / faValue);

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.bars}>
        <div className={styles.barRow}>
          <span className={styles.libraryLabel}>aweXpect</span>
          <span className={styles.bar}>
            <span className={styles.barFillPrimary} style={{width: `${aweXpectWidth}%`}} />
          </span>
          <span className={styles.barValue}>{format(aweXpectValue)}</span>
          <Sparkline values={aweXpectHistory} className={`${styles.sparkline} ${styles.sparklineAwexpect}`} />
        </div>
        <div className={styles.barRow}>
          <span className={styles.libraryLabel}>FluentAssertions</span>
          <span className={styles.bar}>
            <span className={styles.barFillFluentAssertions} style={{width: `${faWidth}%`}} />
          </span>
          <span className={styles.barValue}>{format(faValue)}</span>
          <Sparkline values={faHistory} className={`${styles.sparkline} ${styles.sparklineFluentAssertions}`} />
        </div>
      </div>
      <div className={delta.better ? styles.delta : `${styles.delta} ${styles.deltaWorse}`}>
        {delta.text}
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
      <MetricRow
        label="Time"
        aweXpectValue={entry.aweXpect.timeNs}
        faValue={entry.FluentAssertions.timeNs}
        aweXpectHistory={entry.aweXpect.history?.timeNs}
        faHistory={entry.FluentAssertions.history?.timeNs}
        format={formatNs}
      />
      <MetricRow
        label="Memory"
        aweXpectValue={entry.aweXpect.memoryBytes}
        faValue={entry.FluentAssertions.memoryBytes}
        aweXpectHistory={entry.aweXpect.history?.memoryBytes}
        faHistory={entry.FluentAssertions.history?.memoryBytes}
        format={formatBytes}
      />
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
