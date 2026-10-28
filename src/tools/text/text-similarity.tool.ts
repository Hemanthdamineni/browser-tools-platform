import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-similarity.meta';

/** Above this cell budget the quadratic DP stops feeling instant. */
const MAX_DP_CELLS = 4_000_000;
const MAX_LINE_DISPLAY = 60;
type Metric = 'levenshtein' | 'damerau' | 'jaro-winkler';

function codePoints(value: string): string[] {
  return Array.from(value);
}

function levenshtein(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;

  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    const ca = a[i - 1];
    for (let j = 1; j <= m; j += 1) {
      const cost = ca === b[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[m] ?? 0;
}

/**
 * Optimal string alignment variant: a single adjacent transposition counts as
 * one edit. It is the metric people mean by "Damerau-Levenshtein" in practice,
 * though it differs from the unrestricted variant on repeated substrings.
 */
function damerau(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1).fill(0);
  for (let j = 0; j <= m; j += 1) prev[j] = j;

  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (prev2[j - 2] ?? 0) + 1);
      }
      curr[j] = best;
    }
    const swap = prev2;
    prev2 = prev;
    prev = curr;
    curr = swap;
  }
  return prev[m] ?? 0;
}

function jaroWinkler(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return 1;
  if (n === 0 || m === 0) return 0;

  const window = Math.max(0, Math.floor(Math.max(n, m) / 2) - 1);
  const aMatch = new Array<boolean>(n).fill(false);
  const bMatch = new Array<boolean>(m).fill(false);

  let matches = 0;
  for (let i = 0; i < n; i += 1) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(m - 1, i + window);
    for (let j = lo; j <= hi; j += 1) {
      if (bMatch[j] === true) continue;
      if (a[i] !== b[j]) continue;
      aMatch[i] = true;
      bMatch[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < n; i += 1) {
    if (aMatch[i] !== true) continue;
    while (bMatch[k] !== true) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  transpositions /= 2;

  const jaro = (matches / n + matches / m + (matches - transpositions) / matches) / 3;

  const maxPrefix = Math.min(4, n, m);
  let prefix = 0;
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix += 1;

  return jaro + prefix * 0.1 * (1 - jaro);
}

function sharedPrefix(a: string[], b: string[]): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

function sharedSuffix(a: string[], b: string[]): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

function shorten(value: string): string {
  return value.length <= MAX_LINE_DISPLAY ? value : value.slice(0, MAX_LINE_DISPLAY - 3) + '...';
}

function metricLabel(metric: Metric): string {
  if (metric === 'damerau') return 'Damerau-Levenshtein';
  if (metric === 'jaro-winkler') return 'Jaro-Winkler';
  return 'Levenshtein';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rawMetric = String(o.metric ?? 'levenshtein');
  const metric: Metric =
    rawMetric === 'damerau' || rawMetric === 'jaro-winkler' ? rawMetric : 'levenshtein';
  const caseSensitive = Boolean(o.caseSensitive);
  const trimWhitespace = o.trimWhitespace !== false;
  const sortByScore = String(o.sort ?? 'score') !== 'input';
  const format = String(o.format ?? 'table') === 'lines' ? 'lines' : 'table';
  const limit = Math.max(1, Number(o.limit ?? 200));
  const text = String(input.text ?? '');
  if (text === '') throw new ToolError('Paste some text to compare.');

  const allLines = text.split(/\r\n|\r|\n/u);
  const lines = trimWhitespace
    ? allLines.map((line) => line.trim()).filter((line) => line !== '')
    : allLines;
  if (lines.length === 0) throw new ToolError('Paste some text to compare.');

  const supplied = trimWhitespace ? String(o.reference ?? '').trim() : String(o.reference ?? '');
  const usesFirstLine = supplied === '';
  if (usesFirstLine && lines.length < 2) {
    throw new ToolError(
      'Add a second line to compare against.',
      'The first line is the reference, or fill in the reference text field.',
    );
  }

  const referenceRaw = usesFirstLine ? String(lines[0]) : supplied;
  const reference = caseSensitive ? referenceRaw : referenceRaw.toLowerCase();
  const candidates = usesFirstLine ? lines.slice(1) : lines;

  const refPoints = codePoints(reference);
  const prepared = candidates.map((line) => {
    const normalized = caseSensitive ? line : line.toLowerCase();
    return { line, points: codePoints(normalized) };
  });

  const longest = prepared.reduce(
    (max, item) => Math.max(max, item.points.length),
    refPoints.length,
  );
  if (
    metric !== 'jaro-winkler' &&
    refPoints.length > 0 &&
    longest > 0 &&
    refPoints.length * longest > MAX_DP_CELLS
  ) {
    throw new ToolError(
      'These strings are too long to compare precisely.',
      'Shorten the reference or the lines so the longest pair is under ~2000 characters.',
    );
  }

  const scored = prepared.map((item, index) => {
    let distance: number | null = null;
    let similarity: number;
    if (metric === 'jaro-winkler') {
      similarity = jaroWinkler(refPoints, item.points);
    } else {
      distance =
        metric === 'damerau'
          ? damerau(refPoints, item.points)
          : levenshtein(refPoints, item.points);
      const span = Math.max(refPoints.length, item.points.length);
      similarity = span === 0 ? 1 : 1 - distance / span;
    }
    return {
      index: index + 1,
      line: item.line,
      distance,
      similarity,
      prefix: sharedPrefix(refPoints, item.points),
      suffix: sharedSuffix(refPoints, item.points),
    };
  });

  const ordered = sortByScore
    ? [...scored].sort((a, b) => b.similarity - a.similarity || a.index - b.index)
    : scored;
  const shown = ordered.slice(0, limit);

  const percent = (value: number) => (value * 100).toFixed(1) + '%';
  const rows: string[][] = shown.map((item) => [
    String(item.index),
    shorten(item.line),
    item.distance === null ? 'n/a' : String(item.distance),
    percent(item.similarity),
    String(item.prefix),
    String(item.suffix),
  ]);

  const notes: string[] = [];
  const warnings: string[] = [];
  notes.push('Metric: ' + metricLabel(metric) + '.');
  notes.push(
    usesFirstLine
      ? 'Reference is the first line: "' + shorten(referenceRaw) + '".'
      : 'Reference is the text you supplied.',
  );
  if (!caseSensitive) {
    notes.push('Comparison is case-insensitive.');
  }
  if (ordered.length > shown.length) {
    notes.push('Showing ' + shown.length + ' of ' + ordered.length + ' lines.');
  }
  if (metric === 'jaro-winkler') {
    warnings.push('Jaro-Winkler reports a score between 0 and 1, so no edit distance is shown.');
  }

  const best = scored.reduce((max, item) => Math.max(max, item.similarity), 0);
  const exact = scored.filter((item) => item.similarity >= 0.999_999).length;
  const stats: Record<string, string | number> = {
    linesCompared: scored.length,
    exactMatches: exact,
    closestMatch: percent(best),
  };

  if (format === 'table') {
    return {
      output: JSON.stringify({
        headers: ['#', 'Line', 'Distance', 'Similarity', 'Common prefix', 'Common suffix'],
        rows,
      }),
      render: 'table',
      notes,
      warnings,
      stats,
    };
  }

  const output = shown
    .map(
      (item) =>
        percent(item.similarity) +
        '  d=' +
        (item.distance === null ? 'n/a' : item.distance) +
        '  ' +
        item.line,
    )
    .join('\n');

  return { output, render: 'code', notes, warnings, stats };
}

const tool: TextToolModule = { meta, run };
export default tool;
