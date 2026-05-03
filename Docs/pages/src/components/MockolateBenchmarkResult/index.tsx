/**
 * Renders the latest Mockolate-vs-other-mocking-libraries snapshot for a
 * single benchmark scenario (e.g. "Method", "Property", "Callback").
 * Reads from `src/data/mockolate/benchmarks.json` — refreshed at deploy
 * time by Testably.Site's docs pipeline (the `MockolateBenchmarks` Nuke
 * target) from the `Testably/Mockolate` benchmarks branch. The committed
 * file doubles as a fallback so `npm start`/`npm run build` work in a
 * clean checkout.
 *
 * For benchmarks parameterised with `[Params(1, 10)]`, the component
 * renders inline N=1 / N=10 buttons so readers can switch between
 * fixed-cost and per-call regimes.
 */
import React, {type ReactElement, useState} from 'react';
import benchmarks from '@site/src/data/mockolate/benchmarks.json';
import styles from './styles.module.css';

const BASELINE_LIBRARY = 'Mockolate';
const LIBRARY_ORDER = [
  'Mockolate',
  'Moq',
  'NSubstitute',
  'FakeItEasy',
  'TUnitMocks',
  'Imposter',
] as const;
const LIBRARY_DISPLAY_NAMES: Record<string, string> = {
  TUnitMocks: 'TUnit.Mocks',
};

type Sample = {
  timeNs: number;
  memoryBytes?: number;
  history?: {
    timeNs: number[];
    memoryBytes: number[];
  };
};

type Scenario = {
  parameters: string[];
  samples: Record<string, Record<string, Sample>>;
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
  benchmarks: Record<string, Scenario>;
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

function formatRatio(value: number, baseline: number): string {
  if (baseline === 0) return value === 0 ? '1.00x' : '∞';
  return `${(value / baseline).toFixed(2)}x`;
}

const SPARK_WIDTH = 90;
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

type LibraryRow = {
  library: string;
  value: number;
  history?: number[];
};

type MetricBlockProps = {
  label: string;
  rows: LibraryRow[];
  baselineValue: number;
  format: (n: number) => string;
};

function MetricBlock({label, rows, baselineValue, format}: MetricBlockProps): ReactElement {
  const max = Math.max(...rows.map(r => r.value), 0);

  return (
    <div className={styles.metricBlock}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.bars}>
        {rows.map(row => {
          const isBaseline = row.library === BASELINE_LIBRARY;
          const width = max === 0 ? 0 : (row.value / max) * 100;
          return (
            <div
              key={row.library}
              className={isBaseline ? `${styles.barRow} ${styles.barRowBaseline}` : styles.barRow}>
              <span className={styles.libraryLabel}>
                {LIBRARY_DISPLAY_NAMES[row.library] ?? row.library}
              </span>
              <span className={styles.bar}>
                <span
                  className={isBaseline ? styles.barFillBaseline : styles.barFill}
                  style={{width: `${width}%`}}
                />
              </span>
              <span className={styles.barValue}>{format(row.value)}</span>
              <span className={styles.ratio}>
                {isBaseline ? 'baseline' : formatRatio(row.value, baselineValue)}
              </span>
              <Sparkline
                values={row.history}
                className={isBaseline ? `${styles.sparkline} ${styles.sparklineBaseline}` : styles.sparkline}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildRows(
  samples: Record<string, Sample>,
  picker: (s: Sample) => number | undefined,
  history: (s: Sample) => number[] | undefined,
): LibraryRow[] {
  // Build all available rows for libraries whose dataset includes the metric, then
  // sort by metric value ascending — fastest-first / smallest-allocation-first.
  // Libraries missing this scenario or this metric are skipped silently.
  const rows: LibraryRow[] = [];
  for (const library of LIBRARY_ORDER) {
    const sample = samples[library];
    if (!sample) continue;
    const value = picker(sample);
    if (value === undefined) continue;
    rows.push({library, value, history: history(sample)});
  }
  rows.sort((a, b) => a.value - b.value);
  return rows;
}

type Props = {
  name: string;
};

export default function MockolateBenchmarkResult({name}: Props): ReactElement {
  const scenario = data.benchmarks[name];
  if (!scenario) {
    return (
      <div className={styles.error}>
        No benchmark data for <code>{name}</code>.
      </div>
    );
  }

  const params = scenario.parameters;
  const [activeParam, setActiveParam] = useState(params[0]);
  const samples = scenario.samples[activeParam] ?? {};
  const baselineSample = samples[BASELINE_LIBRARY];

  const timeRows = buildRows(samples, s => s.timeNs, s => s.history?.timeNs);
  const memoryRows = buildRows(samples,
    s => s.memoryBytes,
    s => s.history?.memoryBytes);

  const showParamTabs = params.length > 1 || (params.length === 1 && params[0] !== '');

  return (
    <div className={styles.result}>
      {showParamTabs && (
        <div className={styles.paramTabs} role="tablist" aria-label={`${name} parameter`}>
          {params.map(p => (
            <button
              type="button"
              key={p || '_default'}
              role="tab"
              aria-selected={p === activeParam}
              className={p === activeParam ? `${styles.paramTab} ${styles.paramTabActive}` : styles.paramTab}
              onClick={() => setActiveParam(p)}>
              {p || 'default'}
            </button>
          ))}
        </div>
      )}
      <MetricBlock
        label="Time"
        rows={timeRows}
        baselineValue={baselineSample?.timeNs ?? 0}
        format={formatNs}
      />
      {memoryRows.length > 0 && baselineSample?.memoryBytes !== undefined && (
        <MetricBlock
          label="Memory"
          rows={memoryRows}
          baselineValue={baselineSample.memoryBytes}
          format={formatBytes}
        />
      )}
      <div className={styles.caption}>
        Captured on commit{' '}
        <a
          href={`https://github.com/Testably/Mockolate/commit/${data.capturedAt.sha}`}
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
