/**
 * Renders the latest Testably.Abstractions-vs-System.IO.Abstractions snapshot for a single benchmark scenario (e.g.
 * "Complete", "EnumerateAll"). Reads from `src/data/abstractions/benchmarks.json`, shaped like the Mockolate snapshot.
 */
import React, {type ReactElement, useState} from 'react';
import benchmarks from '@site/src/data/abstractions/benchmarks.json';
import BenchmarkComparison, {BenchmarkError, type Row, type Sample, type Snapshot} from '@site/src/components/BenchmarkComparison';

const BASELINE_LIBRARY = 'Testably';
const LIBRARY_ORDER = ['Testably', 'SystemIOAbstractions'] as const;
const LIBRARY_DISPLAY_NAMES: Record<string, string> = {
  Testably: 'Testably.Abstractions',
  SystemIOAbstractions: 'System.IO.Abstractions',
};

type Scenario = {
  parameters: string[];
  samples: Record<string, Record<string, Sample>>;
};

const data = benchmarks as Snapshot & {benchmarks: Record<string, Scenario>; versions?: Record<string, string>};

/**
 * `labels` maps the BenchmarkDotNet parameter keys (e.g. `N=10&Pattern=*`) to the text of their buttons, in the order
 * of the buttons. Without it the keys are shown as they are.
 */
export default function AbstractionsBenchmarkResult({name, labels}: {name: string; labels?: Record<string, string>}): ReactElement {
  const scenario = data.benchmarks[name];
  const options = labels ? Object.keys(labels).filter(key => scenario?.parameters.includes(key)) : scenario?.parameters ?? [];
  const [activeParameter, setActiveParameter] = useState(options[0] ?? '');
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
  const hasParameters = scenario.parameters.length > 1 || scenario.parameters[0] !== '';

  return (
    <BenchmarkComparison
      baseline={BASELINE_LIBRARY}
      rows={rows}
      parameters={hasParameters ? {
        label: `${name} parameter`,
        options: options.map(key => labels?.[key] ?? key),
        active: labels?.[activeParameter] ?? activeParameter,
        onChange: label => setActiveParameter(options.find(key => (labels?.[key] ?? key) === label) ?? label),
      } : undefined}
      snapshot={data}
      repository="Testably/Testably.Abstractions"
    />
  );
}
