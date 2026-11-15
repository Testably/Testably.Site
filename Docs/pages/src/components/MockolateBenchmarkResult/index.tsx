/**
 * Renders the latest Mockolate-vs-other-mocking-libraries snapshot for a single benchmark scenario (e.g. "Method",
 * "Property", "Callback"). Reads from `src/data/mockolate/benchmarks.json`, refreshed at deploy time by the
 * `MockolateBenchmarks` Fallout target from the `Testably/Mockolate` benchmarks branch. The committed file doubles as
 * a fallback so `npm start`/`npm run build` work in a clean checkout.
 */
import React, {type ReactElement, useState} from 'react';
import benchmarks from '@site/src/data/mockolate/benchmarks.json';
import BenchmarkComparison, {BenchmarkError, type Row, type Sample, type Snapshot} from '@site/src/components/BenchmarkComparison';

const BASELINE_LIBRARY = 'Mockolate';
const LIBRARY_ORDER = ['Mockolate', 'Moq', 'NSubstitute', 'FakeItEasy', 'TUnitMocks', 'Imposter'] as const;
const LIBRARY_DISPLAY_NAMES: Record<string, string> = {
  TUnitMocks: 'TUnit.Mocks',
};

type Scenario = {
  parameters: string[];
  samples: Record<string, Record<string, Sample>>;
};

const data = benchmarks as Snapshot & {benchmarks: Record<string, Scenario>; versions?: Record<string, string>};

export default function MockolateBenchmarkResult({name}: {name: string}): ReactElement {
  const scenario = data.benchmarks[name];
  const [activeParameter, setActiveParameter] = useState(scenario?.parameters[0] ?? '');
  if (!scenario) {
    return (
      <BenchmarkError>
        No benchmark data for <code>{name}</code>.
      </BenchmarkError>
    );
  }

  const samples = scenario.samples[activeParameter] ?? {};
  const displayName = (library: string): string => LIBRARY_DISPLAY_NAMES[library] ?? library;
  const rows: Row[] = LIBRARY_ORDER.filter(library => samples[library]).map(library => ({
    key: library,
    name: displayName(library),
    version: data.versions?.[library],
    sample: samples[library],
  }));
  const missing = LIBRARY_ORDER.filter(library => !samples[library]).map(displayName);
  const hasParameters = scenario.parameters.length > 1 || scenario.parameters[0] !== '';

  return (
    <BenchmarkComparison
      baseline={BASELINE_LIBRARY}
      rows={rows}
      missing={missing}
      parameters={hasParameters ? {label: `${name} parameter`, options: scenario.parameters, active: activeParameter, onChange: setActiveParameter} : undefined}
      snapshot={data}
      repository="Testably/Mockolate"
    />
  );
}
