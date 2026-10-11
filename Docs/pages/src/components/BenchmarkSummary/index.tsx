/**
 * Summarises the latest aweXpect benchmark snapshot: for each other library,
 * in how many benchmarks it is slower or allocates more than aweXpect, and the
 * median factor. Reads the same `src/data/awexpect/benchmarks.json` as
 * `BenchmarkResult`.
 */
import React, {type ReactElement} from 'react';
import benchmarks from '@site/src/data/awexpect/benchmarks.json';

type Sample = {
  timeNs: number;
  memoryBytes?: number;
};

type BenchmarkEntry = {
  aweXpect: Sample;
  FluentAssertions: Sample;
  TUnit?: Sample;
};

const entries = Object.values((benchmarks as {benchmarks: Record<string, BenchmarkEntry>}).benchmarks);

const OTHER_LIBRARIES = ['FluentAssertions', 'TUnit'] as const;

const METRICS = [
  {key: 'timeNs', label: 'Slower', worse: 'slower', better: 'faster'},
  {key: 'memoryBytes', label: 'More', worse: 'more', better: 'less'},
] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function summarize(
  library: (typeof OTHER_LIBRARIES)[number],
  metric: (typeof METRICS)[number],
): string {
  const ratios = entries.flatMap((entry) => {
    const awe = entry.aweXpect[metric.key];
    const other = entry[library]?.[metric.key];
    if (awe === undefined || other === undefined) return [];
    if (awe === other) return [1];
    return [awe === 0 ? Infinity : other / awe];
  });
  if (ratios.length === 0) return '–';

  const worse = ratios.filter((ratio) => ratio > 1).length;
  const factor = median(ratios);
  const typical = factor >= 1
    ? `${factor.toFixed(2)}× ${metric.worse}`
    : `${(1 / factor).toFixed(2)}× ${metric.better}`;
  return `${metric.label} in ${worse} of ${ratios.length} (median ${typical})`;
}

export default function BenchmarkSummary(): ReactElement {
  return (
    <table>
      <thead>
        <tr>
          <th>Compared to aweXpect</th>
          <th>Time</th>
          <th>Memory</th>
        </tr>
      </thead>
      <tbody>
        {OTHER_LIBRARIES.map((library) => (
          <tr key={library}>
            <td>{library}</td>
            {METRICS.map((metric) => (
              <td key={metric.key}>{summarize(library, metric)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
