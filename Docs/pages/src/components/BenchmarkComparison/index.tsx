/**
 * Renders one benchmark of a library against its competitors: a headline number and one row per library with its
 * version, time and memory bars that race to their values when they scroll into view, and the time trend over the
 * recent runs.
 * The library-specific wrappers (`BenchmarkResult`, `MockolateBenchmarkResult`) map their snapshot into the rows.
 */
import React, {type ReactElement, type ReactNode, useEffect, useRef, useState} from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
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
      // The first frame's timestamp can lie before `start`, which would count the values below zero.
      const time = Math.max(0, now - start);
      setElapsed(time);
      if (time < end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, end]);
  return elapsed;
}

/**
 * The cut of a chart and when its slowest bar finishes, over the libraries that have the metric.
 */
function scaleOf(rows: Row[], metric: Metric): {cap: number; end: number} {
  const positive = rows.map(row => row.sample[metric]).filter((v): v is number => v !== undefined && v > 0);
  // Bars beyond four times the smallest value are cut, so one slow library does not flatten all the others.
  const cap = positive.length > 0 ? Math.min(...positive) * 4 : 1;
  const end = Math.max(0, ...positive.map(v => {
    const race = raceOf(v, cap);
    return race.grow + race.overtime;
  }));
  return {cap, end};
}

type MeasureProps = {metric: Metric; row: Row; baseline: Row; cap: number; elapsed: number};

function Measure({metric, row, baseline, cap, elapsed}: MeasureProps): ReactElement {
  const value = row.sample[metric];
  const area = metric === 'timeNs' ? 'time' : 'memory';
  if (value === undefined) {
    return (
      <>
        <span role="cell" className={styles.track} style={{gridArea: `${area}Bar`}} />
        <span role="cell" className={styles.chartValue} style={{gridArea: `${area}Value`}} title={`${row.name}: not measured`}>
          —
        </span>
        <span role="cell" style={{gridArea: `${area}Factor`}} />
      </>
    );
  }
  const baselineValue = baseline.sample[metric]!;
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
  const title = isBaseline ? `${row.name}: ${FORMAT[metric](value)}` : comparison.title;
  const barClass = [styles.bar, race.cut && styles.barCut, metric === 'memoryBytes' && styles.barHatched].filter(Boolean).join(' ');

  return (
    <>
      <span role="cell" className={styles.track} style={{gridArea: `${area}Bar`}} title={title}>
        {value > 0 && <span className={barClass} style={barStyle} />}
      </span>
      <span role="cell" className={styles.chartValue} style={{gridArea: `${area}Value`}} title={title}>
        {FORMAT[metric](shown)}
      </span>
      <span role="cell" className={styles.chartFactor} style={{gridArea: `${area}Factor`}} title={title}>
        {isBaseline ? '' : shown === value ? comparison.text : compare(baselineValue, shown, metric, row.name, baseline.name).text}
      </span>
    </>
  );
}

type BoardProps = {rows: Row[]; baseline: Row; racing: boolean; finished: boolean};

/**
 * One row per library, sorted by time, with its version, the time and memory bars and the time trend side by side.
 */
function Board({rows, baseline, racing, finished}: BoardProps): ReactElement {
  const time = scaleOf(rows, 'timeNs');
  const memory = baseline.sample.memoryBytes === undefined ? undefined : scaleOf(rows, 'memoryBytes');
  const clock = useRaceClock(racing && !finished, Math.max(time.end, memory?.end ?? 0));
  const isBrowser = useIsBrowser();
  // The static render shows the final values; the race only starts once the page is interactive.
  const elapsed = finished || !isBrowser ? Infinity : clock;
  const sorted = [...rows].sort((a, b) => a.sample.timeNs - b.sample.timeNs);

  return (
    <div role="table" aria-label="Benchmark results per library" className={memory ? styles.board : `${styles.board} ${styles.boardWithoutMemory}`}>
      <div role="row" className={styles.boardHeader}>
        <span role="columnheader" aria-label="Library" className={styles.boardHeaderName} />
        <span role="columnheader" aria-colspan={4} style={{gridArea: 'time'}}>
          <span className={styles.swatch} />
          Time
        </span>
        {memory && (
          <span role="columnheader" aria-colspan={3} style={{gridArea: 'memory'}}>
            <span className={`${styles.swatch} ${styles.barHatched}`} />
            Memory
          </span>
        )}
      </div>
      {sorted.map(row => {
        const isBaseline = row.key === baseline.key;
        const ratios = ratioHistory(baseline.sample.history?.timeNs, row.sample.history?.timeNs);
        return (
          <div role="row" key={row.key} className={isBaseline ? `${styles.boardRow} ${styles.boardRowBaseline}` : styles.boardRow}>
            <span role="rowheader" className={styles.chartName}>
              <span>{row.name}</span>
              {row.version && <span className={styles.version}>{row.version}</span>}
            </span>
            <Measure metric="timeNs" row={row} baseline={baseline} cap={time.cap} elapsed={elapsed} />
            <span role="cell" className={styles.chartTrend}>
              {!isBaseline && (
                <Sparkline values={ratios} title={`${row.name} compared to ${baseline.name} over the last ${ratios.length} runs; the dashed line marks equal time`} />
              )}
            </span>
            {memory && <Measure metric="memoryBytes" row={row} baseline={baseline} cap={memory.cap} elapsed={elapsed} />}
          </div>
        );
      })}
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
            <Board rows={rows} baseline={baseline} racing={inView} finished={skipped} />
          </div>
          <div className={styles.noteRow}>
            <p className={styles.note}>
              Lower is better. Bars longer than four times the fastest library are cut so the others stay comparable. The
              line after each time shows the last runs compared to {baseline.name}. Hover a bar, a multiple or a line for
              the exact comparison.
              {missing.length > 0 && <> Not measured in this benchmark: {missing.join(', ')}.</>}
            </p>
            <RaceButton
              key={raceKey}
              running={inView && !skipped}
              end={Math.max(scaleOf(rows, 'timeNs').end, scaleOf(rows, 'memoryBytes').end)}
              onSkip={() => setSkippedRace(raceKey)}
              onReplay={() => setRace(r => r + 1)}
            />
          </div>
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
