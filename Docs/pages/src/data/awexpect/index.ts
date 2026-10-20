/**
 * The benchmark snapshot of aweXpect and of each extension package, keyed by package name, as written by the
 * `Benchmarks` Fallout target. Docusaurus only bundles statically imported JSON, so every package is listed here.
 */
import aweXpect from './benchmarks.json';
import aweXpectJson from './aweXpect.Json/benchmarks.json';
import aweXpectReflection from './aweXpect.Reflection/benchmarks.json';
import aweXpectWeb from './aweXpect.Web/benchmarks.json';
import aweXpectXml from './aweXpect.Xml/benchmarks.json';

const benchmarksByPackage: Record<string, unknown> = {
  aweXpect,
  'aweXpect.Json': aweXpectJson,
  'aweXpect.Reflection': aweXpectReflection,
  'aweXpect.Web': aweXpectWeb,
  'aweXpect.Xml': aweXpectXml,
};

export default benchmarksByPackage;
