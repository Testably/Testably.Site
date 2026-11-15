/**
 * Renders one benchmark of a library against its competitors: a headline number, time and memory charts whose bars
 * race to their values when they scroll into view, and a scoreboard with versions and the trend over the recent runs.
 * The library-specific wrappers (`BenchmarkResult`, `MockolateBenchmarkResult`) map their snapshot into the rows.
 */
import React, {type ReactElement, type ReactNode, useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

/**
 * How long a bar takes to grow across the whole track. All bars grow at the same speed, so each one finishes after a
 * time proportional to its value; the measured nanoseconds themselves would be far too short to see.
 */
const RACE_MS = 1_000;
/**
 * A cut bar keeps running in proportion to its value up to this many track lengths, then logarithmically, because the
 * slowest libraries would otherwise take minutes.
 */
const PROPORTIONAL_TRACKS = 4;
const LOG_SCALE = 0.3;
/**
 * The cut mark moves at a fixed speed, one full sweep per `SLIDE_MS`, so a short overtime gives a shorter sweep instead
 * of a faster one.
 */
const SLIDE_MS = 350;
const SLIDE_PX = 26;

export type Sample = {
  timeNs: number;
  memoryBytes?: number;
  history?: {
    timeNs: number[];
    memoryBytes: number[];
  };
};

export type Row = {key: string; name: string; version?: string; sample: Sample};

export type Snapshot = {
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
};

type Metric = 'timeNs' | 'memoryBytes';

/**
 * Worded as "1.10× as long" rather than "1.10× slower", which could just as well be read as 110% slower.
 */
const WORDING: Record<Metric, {verb: string; amount: string}> = {
  timeNs: {verb: 'takes', amount: 'as long'},
  memoryBytes: {verb: 'allocates', amount: 'as much'},
};

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

const FORMAT: Record<Metric, (n: number) => string> = {timeNs: formatNs, memoryBytes: formatBytes};

function formatFactor(factor: number): string {
  if (factor < 10) return `${factor.toFixed(1)}×`;
  return `${Math.round(factor).toLocaleString('en-US')}×`;
}

/**
 * A multiple of the baseline, or the absolute difference when the baseline allocates nothing and a multiple has no
 * meaning.
 */
function compare(baseline: number, value: number, metric: Metric, name: string, baselineName: string): {text: string; title: string} {
  const {verb, amount} = WORDING[metric];
  if (baseline === value) return {text: 'same', title: `${name} ${verb} ${amount} as ${baselineName}`};
  if (baseline === 0) {
    return {text: `+${FORMAT[metric](value)}`, title: `${name} ${verb} ${FORMAT[metric](value)}, ${baselineName} nothing`};
  }
  const factor = value / baseline;
  return {text: formatFactor(factor), title: `${name} ${verb} ${factor.toFixed(2)}× ${amount} as ${baselineName}`};
}

/**
 * The ratio of a library to the baseline for each run, aligned from the newest run, because a library that was added
 * later has a shorter history. A ratio of the same run does not depend on the speed of the runner.
 */
function ratioHistory(baseline: number[] | undefined, other: number[] | undefined): number[] {
  if (!baseline || !other) return [];
  const count = Math.min(baseline.length, other.length);
  return Array.from({length: count}, (_, i) => {
    const baselineValue = baseline[baseline.length - count + i];
    const otherValue = other[other.length - count + i];
    return baselineValue === otherValue ? 1 : otherValue / baselineValue;
  }).filter(Number.isFinite);
}

const SPARK_WIDTH = 72;
const SPARK_HEIGHT = 20;
const SPARK_PADDING = 3;

function Sparkline({values, title}: {values: number[]; title: string}): ReactElement | null {
  if (values.length < 2) return null;

  // Parity is always in range, so a stable ratio stays flat instead of stretching noise to full height.
  const min = Math.min(1, ...values);
  const max = Math.max(1, ...values);
  const range = max - min;
  const innerHeight = SPARK_HEIGHT - SPARK_PADDING * 2;
  const toY = (v: number): number =>
    range === 0 ? SPARK_HEIGHT / 2 : SPARK_PADDING + innerHeight - ((v - min) / range) * innerHeight;
  const points = values.map((v, i) => [(i / (values.length - 1)) * SPARK_WIDTH, toY(v)] as const);
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg className={styles.sparkline} width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} role="img" aria-label={title}>
      <title>{title}</title>
      <line x1={0} y1={toY(1)} x2={SPARK_WIDTH} y2={toY(1)} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="currentColor" />
    </svg>
  );
}

type Race = {width: number; cut: boolean; grow: number; overtime: number};

function raceOf(value: number, cap: number): Race {
  const cut = value > cap;
  const width = cut ? 100 : (value / cap) * 100;
  return {
    width,
    cut,
    grow: (width / 100) * RACE_MS,
    overtime: cut ? (runTime(value / cap) - 1) * RACE_MS : 0,
  };
}

/**
 * The run time in tracks of a bar `tracks` times as long as the track: proportional up to `PROPORTIONAL_TRACKS`,
 * logarithmic beyond.
 */
function runTime(tracks: number): number {
  if (tracks <= PROPORTIONAL_TRACKS) return tracks;
  return PROPORTIONAL_TRACKS * (1 + LOG_SCALE * Math.log(tracks / PROPORTIONAL_TRACKS));
}

/**
 * The value shown after `elapsed` ms, the inverse of `runTime`, so the count speeds up once the run time is
 * logarithmic.
 */
function valueAt(value: number, cap: number, race: Race, elapsed: number): number {
  if (elapsed >= race.grow + race.overtime) return value;
  const t = elapsed / RACE_MS;
  const tracks = t <= PROPORTIONAL_TRACKS ? t : PROPORTIONAL_TRACKS * Math.exp((t / PROPORTIONAL_TRACKS - 1) / LOG_SCALE);
  return Math.min(value, cap * tracks);
}

function useRaceClock(running: boolean, end: number): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(Infinity);
      return undefined;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setElapsed(now - start);
      if (now - start < end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, end]);
  return elapsed;
}

/**
 * The cut of a chart and when its slowest bar finishes, or `undefined` when a library lacks the metric.
 */
function scaleOf(rows: Row[], metric: Metric): {cap: number; end: number} | undefined {
  const values = rows.map(row => row.sample[metric]);
  if (values.some(v => v === undefined)) return undefined;
  const positive = (values as number[]).filter(v => v > 0);
  // Bars beyond four times the smallest value are cut, so one slow library does not flatten all the others.
  const cap = positive.length > 0 ? Math.min(...positive) * 4 : 1;
  const end = Math.max(0, ...positive.map(v => {
    const race = raceOf(v, cap);
    return race.grow + race.overtime;
  }));
  return {cap, end};
}

type ChartProps = {title: string; metric: Metric; rows: Row[]; baseline: Row; racing: boolean; finished: boolean};

function Chart({title, metric, rows, baseline, racing, finished}: ChartProps): ReactElement | null {
  const scale = scaleOf(rows, metric);
  const clock = useRaceClock(racing && !finished, scale?.end ?? 0);
  if (!scale) return null;
  const {cap} = scale;
  const elapsed = finished ? Infinity : clock;
  const sorted = [...rows].sort((a, b) => a.sample[metric]! - b.sample[metric]!);
  const baselineValue = baseline.sample[metric]!;

  return (
    <div className={styles.chart}>
      <div className={styles.chartHeader}>
        <h4>{title}</h4>
        <span>lower is better</span>
      </div>
      <div className={styles.chartRows}>
        {sorted.map(row => {
          const value = row.sample[metric]!;
          const isBaseline = row.key === baseline.key;
          const race = raceOf(value, cap);
          const comparison = compare(baselineValue, value, metric, row.name, baseline.name);
          const raw = value > 0 ? valueAt(value, cap, race, elapsed) : value;
          const shown = metric === 'memoryBytes' ? Math.round(raw) : raw;
          const slides = Math.max(1, Math.round(race.overtime / (2 * SLIDE_MS)));
          const sweep = Math.min(1, race.overtime / slides / (2 * SLIDE_MS)) * SLIDE_PX;
          const barStyle = {
            width: `${race.width}%`,
            animationDuration: `${race.grow}ms`,
            '--grow': `${race.grow}ms`,
            '--slide': `${race.overtime / slides}ms`,
            '--slides': slides,
            '--sweep': `${sweep}px`,
          } as React.CSSProperties;
          return (
            <div key={row.key} className={isBaseline ? `${styles.chartRow} ${styles.chartRowBaseline}` : styles.chartRow} title={isBaseline ? `${row.name}: ${FORMAT[metric](value)}` : comparison.title}>
              <span className={styles.chartName}>{row.name}</span>
              <span className={styles.track}>
                {value > 0 && (
                  <span className={race.cut ? `${styles.bar} ${styles.barCut}` : styles.bar} style={barStyle} />
                )}
              </span>
              <span className={styles.chartValue}>{FORMAT[metric](shown)}</span>
              <span className={styles.chartFactor}>
                {isBaseline ? '' : shown === value ? comparison.text : compare(baselineValue, shown, metric, row.name, baseline.name).text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Headline({rows, baseline}: {rows: Row[]; baseline: Row}): ReactElement {
  const others = rows.filter(row => row.key !== baseline.key).sort((a, b) => a.sample.timeNs - b.sample.timeNs);
  const fastest = others[0];
  const slowest = others[others.length - 1];
  const baselineTime = baseline.sample.timeNs;
  const factor = (row: Row) => formatFactor(row.sample.timeNs / baselineTime);

  let sentence: ReactElement;
  if (!fastest) {
    sentence = <>No other library was measured in this benchmark.</>;
  } else if (fastest.sample.timeNs < baselineTime) {
    sentence = (
      <>
        {fastest.name} is {others.length === 1 ? 'faster' : 'the fastest'} here at {formatNs(fastest.sample.timeNs)};{' '}
        {baseline.name} takes{' '}
        <strong>{formatFactor(baselineTime / fastest.sample.timeNs)}</strong> as long.
      </>
    );
  } else if (fastest.sample.timeNs === baselineTime) {
    sentence = <>{fastest.name} is as fast as {baseline.name} here.</>;
  } else {
    sentence = (
      <>
        {others.length === 1 ? fastest.name : <>The next fastest library, {fastest.name},</>} takes{' '}
        <strong>{factor(fastest)}</strong> as long
        {slowest !== fastest && (
          <>
            , and {slowest.name} takes <strong>{factor(slowest)}</strong> as long
          </>
        )}
        .
      </>
    );
  }

  return (
    <div className={styles.headline}>
      <div className={styles.headlineNumber}>
        <span>{formatNs(baselineTime)}</span>
        <span>with {baseline.name}</span>
      </div>
      <p>{sentence}</p>
    </div>
  );
}

function Scoreboard({rows, baseline, missing}: {rows: Row[]; baseline: Row; missing: string[]}): ReactElement {
  const sorted = [...rows].sort((a, b) => a.sample.timeNs - b.sample.timeNs);
  const hasMemory = baseline.sample.memoryBytes !== undefined;
  const columns = hasMemory ? 6 : 4;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Library</th>
            <th className={styles.number}>Time</th>
            <th className={styles.trend}>recent runs</th>
            <th>vs {baseline.name}</th>
            {hasMemory && <th className={styles.number}>Memory</th>}
            {hasMemory && <th>vs {baseline.name}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const isBaseline = row.key === baseline.key;
            const time = compare(baseline.sample.timeNs, row.sample.timeNs, 'timeNs', row.name, baseline.name);
            const memory =
              hasMemory && row.sample.memoryBytes !== undefined
                ? compare(baseline.sample.memoryBytes!, row.sample.memoryBytes, 'memoryBytes', row.name, baseline.name)
                : undefined;
            const ratios = ratioHistory(baseline.sample.history?.timeNs, row.sample.history?.timeNs);
            return (
              <tr key={row.key} className={isBaseline ? styles.baselineRow : undefined}>
                <td>
                  <span className={styles.tableName}>{row.name}</span>
                  {row.version && <span className={styles.version}>{row.version}</span>}
                </td>
                <td className={styles.number}>{formatNs(row.sample.timeNs)}</td>
                <td className={styles.trend}>
                  {!isBaseline && (
                    <Sparkline values={ratios} title={`${row.name} compared to ${baseline.name} over the last ${ratios.length} runs; the dashed line marks equal time`} />
                  )}
                </td>
                <td title={isBaseline ? undefined : time.title}>{isBaseline ? <span className={styles.baselineTag}>baseline</span> : time.text}</td>
                {hasMemory && (
                  <td className={styles.number}>
                    {row.sample.memoryBytes === undefined ? '—' : formatBytes(row.sample.memoryBytes)}
                  </td>
                )}
                {hasMemory && (
                  <td title={isBaseline ? undefined : memory?.title}>
                    {isBaseline ? <span className={styles.baselineTag}>baseline</span> : (memory?.text ?? '—')}
                  </td>
                )}
              </tr>
            );
          })}
          {missing.length > 0 && (
            <tr className={styles.missingRow}>
              <td colSpan={columns}>Not measured in this benchmark: {missing.join(', ')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skips to the results while the race runs and starts it again once it is over.
 */
function RaceButton({running, end, onSkip, onReplay}: {running: boolean; end: number; onSkip: () => void; onReplay: () => void}): ReactElement {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = setTimeout(() => setOver(true), reducedMotion ? 0 : end);
    return () => clearTimeout(timeout);
  }, [running, end]);
  const done = over || !running;
  return (
    <button type="button" className={styles.chip} onClick={done ? onReplay : onSkip}>
      {done ? 'Race again' : 'Skip to results'}
    </button>
  );
}

export function BenchmarkError({children}: {children: ReactNode}): ReactElement {
  return <div className={styles.error}>{children}</div>;
}

type Props = {
  baseline: string;
  rows: Row[];
  missing?: string[];
  parameters?: {label: string; options: string[]; active: string; onChange: (option: string) => void};
  snapshot: Snapshot;
  repository: string;
};

export default function BenchmarkComparison({baseline: baselineKey, rows, missing = [], parameters, snapshot, repository}: Props): ReactElement {
  const resultRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [race, setRace] = useState(0);
  const [skippedRace, setSkippedRace] = useState<string>();
  useEffect(() => {
    if (!resultRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    });
    observer.observe(resultRef.current);
    return () => observer.disconnect();
  }, []);

  const baseline = rows.find(row => row.key === baselineKey);
  const raceKey = `${parameters?.active ?? ''}/${race}`;
  const skipped = skippedRace === raceKey;

  return (
    <div ref={resultRef} className={styles.result}>
      {parameters && (
        <div className={styles.sizes} role="group" aria-label={parameters.label}>
          {parameters.options.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={option === parameters.active}
              className={option === parameters.active ? `${styles.size} ${styles.sizeActive}` : styles.size}
              onClick={() => parameters.onChange(option)}>
              {option}
            </button>
          ))}
        </div>
      )}

      {baseline ? (
        <>
          <Headline rows={rows} baseline={baseline} />
          <div
            key={raceKey}
            className={`${styles.charts} ${inView ? styles.racing : ''} ${skipped ? styles.finished : ''}`}>
            <Chart title="Time" metric="timeNs" rows={rows} baseline={baseline} racing={inView} finished={skipped} />
            <Chart title="Memory" metric="memoryBytes" rows={rows} baseline={baseline} racing={inView} finished={skipped} />
          </div>
          <div className={styles.noteRow}>
            <p className={styles.note}>
              Bars longer than four times the fastest library are cut so the others stay comparable. Hover a bar or a
              multiple for the exact comparison.
            </p>
            <RaceButton
              key={raceKey}
              running={inView && !skipped}
              end={Math.max(scaleOf(rows, 'timeNs')?.end ?? 0, scaleOf(rows, 'memoryBytes')?.end ?? 0)}
              onSkip={() => setSkippedRace(raceKey)}
              onReplay={() => setRace(r => r + 1)}
            />
          </div>
          <Scoreboard rows={rows} baseline={baseline} missing={missing} />
        </>
      ) : (
        <div className={styles.error}>No measurement of the baseline in this benchmark.</div>
      )}

      <div className={styles.caption}>
        <span>
          Measured on {snapshot.capturedAt.date} at commit{' '}
          <a href={`https://github.com/${repository}/commit/${snapshot.capturedAt.sha}`} title={snapshot.capturedAt.message}>
            <code>{snapshot.capturedAt.shortSha}</code>
          </a>
        </span>
        {snapshot.environment?.toolchain && <span>{snapshot.environment.toolchain}</span>}
        {snapshot.environment?.runner && <span>{snapshot.environment.runner}</span>}
      </div>
    </div>
  );
}
