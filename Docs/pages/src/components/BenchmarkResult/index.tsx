/**
 * Renders the latest aweXpect vs FluentAssertions and TUnit snapshot for a single benchmark name (e.g. "Bool",
 * "String", "Int_GreaterThan") of a package (`aweXpect` by default, or an extension package such as `aweXpect.Json`).
 * Reads from `src/data/awexpect/benchmarks.json` (or `src/data/awexpect/<package>/benchmarks.json`), refreshed at
 * deploy time by the `Benchmarks` Fallout target from the `Testably/aweXpect` benchmarks branch. The committed file
 * doubles as a fallback so `npm start`/`npm run build` work in a clean checkout.
 */
import React, {type ReactElement} from 'react';
import benchmarksByPackage from '@site/src/data/awexpect';
import BenchmarkComparison, {BenchmarkError, type Row, type Sample, type Snapshot} from '@site/src/components/BenchmarkComparison';

const BASELINE_LIBRARY = 'aweXpect';
const LIBRARY_ORDER = ['aweXpect', 'FluentAssertions', 'TUnit'] as const;

type Data = Snapshot & {benchmarks: Record<string, Partial<Record<string, Sample>>>; versions?: Record<string, string>};

type Props = {
  package?: string;
  name: string;
};

// `package` is a reserved word in strict mode, so it cannot be destructured under its own name.
export default function BenchmarkResult({package: packageName = 'aweXpect', name}: Props): ReactElement {
  const data = benchmarksByPackage[packageName] as Data | undefined;
  const entry = data?.benchmarks[name];
  if (!data || !entry) {
    return (
      <BenchmarkError>
        No benchmark data for <code>{name}</code> of <code>{packageName}</code>.
      </BenchmarkError>
    );
  }

  const rows: Row[] = LIBRARY_ORDER.filter(library => entry[library]).map(library => ({
    key: library,
    name: library,
    version: data.versions?.[library],
    sample: entry[library]!,
  }));

  return <BenchmarkComparison baseline={BASELINE_LIBRARY} rows={rows} snapshot={data} repository="Testably/aweXpect" />;
}
