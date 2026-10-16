import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './semver.meta';

type Version = { raw: string; major: number; minor: number; patch: number; prerelease: string[]; build: string[] };
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parse(raw: string): Version | null {
  const value = raw.trim();
  const match = VERSION.exec(value);
  if (!match) return null;
  return { raw: value, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4]?.split('.') ?? [], build: match[5]?.split('.') ?? [] };
}

function compare(left: Version, right: Version): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    const a = left.prerelease[i]; const b = right.prerelease[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a); const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) - Number(b);
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (!['validate', 'compare', 'sort'].includes(mode)) throw new ToolError('Choose a supported SemVer mode.');
  const values = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (mode === 'compare') {
    if (values.length !== 1) throw new ToolError('Compare mode expects exactly one version in the input.');
    const left = parse(values[0]!); const right = parse(String(options.secondVersion).trim());
    if (!left || !right) throw new ToolError('Both values must be valid strict SemVer 2.0.0 versions.');
    const result = compare(left, right);
    const relation = result === 0 ? 'equal precedence' : result < 0 ? 'less than' : 'greater than';
    return { output: `${left.raw} is ${relation} ${right.raw}.`, render: 'text', stats: { comparison: relation, 'build metadata ignored': 'yes' } };
  }
  const parsed = values.map((value) => ({ value, version: parse(value) }));
  const invalid = parsed.filter((item) => !item.version);
  if (mode === 'validate') {
    const rows = parsed.map((item) => [item.value, item.version ? 'Valid' : 'Invalid', item.version ? 'SemVer 2.0.0' : 'Expected MAJOR.MINOR.PATCH with optional prerelease/build']);
    return { output: JSON.stringify({ headers: ['Version', 'Result', 'Details'], rows }), render: 'table', stats: { checked: parsed.length, valid: parsed.length - invalid.length, invalid: invalid.length } };
  }
  if (invalid.length) throw new ToolError('Sort mode requires every line to be valid strict SemVer 2.0.0.', `Invalid value: ${invalid[0]!.value}`);
  const sorted = parsed.map((item) => item.version!).sort(compare);
  if (options.descending) sorted.reverse();
  return { output: sorted.map((version) => version.raw).join('\n'), render: 'code', language: 'text', stats: { versions: sorted.length, order: options.descending ? 'descending' : 'ascending' }, notes: ['Build metadata is preserved but does not affect sort precedence.'] };
}

const tool: TextToolModule = { meta, run };
export default tool;
