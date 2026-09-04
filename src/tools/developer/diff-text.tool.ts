import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './diff-text.meta';
import * as Diff from 'diff';

interface Part {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function ensureTrailingNewline(s: string): string {
  return s === '' || s.endsWith('\n') ? s : s + '\n';
}

function countUnits(value: string, granularity: string): number {
  if (value === '') return 0;
  if (granularity === 'chars') return [...value].length;
  if (granularity === 'words') return value.match(/\S+/g)?.length ?? 0;
  return value.replace(/\n$/, '').split('\n').length;
}

function diffParts(a: string, b: string, granularity: string): Part[] {
  if (granularity === 'words') return Diff.diffWords(a, b) as Part[];
  if (granularity === 'chars') return Diff.diffChars(a, b) as Part[];
  return Diff.diffLines(a, b) as Part[];
}

/** Wrap the non-newline core of a segment, keeping any trailing newline outside the markers. */
function wrapInline(value: string, open: string, close: string): string {
  const match = /^([\s\S]*?)(\n*)$/.exec(value);
  const core = match ? match[1]! : value;
  const tail = match ? match[2]! : '';
  return core === '' ? tail : open + core + close + tail;
}

function renderInline(parts: Part[]): string {
  let out = '';
  for (const p of parts) {
    if (p.added) out += wrapInline(p.value, '{+', '+}');
    else if (p.removed) out += wrapInline(p.value, '[-', '-]');
    else out += p.value;
  }
  return out;
}

function renderUnifiedLines(a: string, b: string): string {
  const patch = Diff.structuredPatch(
    'A',
    'B',
    ensureTrailingNewline(a),
    ensureTrailingNewline(b),
    '',
    '',
    { context: 3 },
  );
  const lines: string[] = ['--- A', '+++ B'];
  for (const hunk of patch.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    for (const line of hunk.lines) {
      if (line === '\\ No newline at end of file') continue;
      lines.push(line);
    }
  }
  return lines.join('\n');
}

function renderUnifiedParts(parts: Part[], granularity: string): string {
  const unit = granularity === 'chars' ? 'character' : 'word';
  const lines: string[] = ['--- A', '+++ B', `@@ ${unit}-level diff @@`];
  for (const p of parts) {
    if (!p.added && !p.removed) continue;
    const prefix = p.added ? '+' : '-';
    for (const seg of p.value.split('\n')) lines.push(prefix + seg);
  }
  return lines.join('\n');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const a = input.text ?? '';
  const b = String(o.second ?? '');
  if (!a && !b) return { output: '' };

  const granularity = String(o.granularity);
  const format = String(o.format);

  const parts = diffParts(a, b, granularity);

  let additions = 0;
  let deletions = 0;
  for (const p of parts) {
    if (p.added) additions += countUnits(p.value, granularity);
    else if (p.removed) deletions += countUnits(p.value, granularity);
  }

  if (additions === 0 && deletions === 0) {
    return {
      output: '',
      render: 'diff',
      stats: { additions: 0, deletions: 0 },
      notes: ['The two texts are identical.'],
    };
  }

  let output: string;
  if (format === 'inline') {
    output = renderInline(parts);
  } else if (granularity === 'lines') {
    output = renderUnifiedLines(a, b);
  } else {
    output = renderUnifiedParts(parts, granularity);
  }

  return {
    output,
    render: 'diff',
    filename: format === 'inline' ? 'diff.txt' : 'diff.patch',
    stats: { granularity, additions, deletions },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
