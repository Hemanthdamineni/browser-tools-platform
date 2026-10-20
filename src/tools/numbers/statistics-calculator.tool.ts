import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './statistics-calculator.meta';

type Row = [string, string];

interface Input {
  values: number[];
  skipped: number;
}

function parseNumbers(text: string): Input {
  const values: number[] = [];
  let skipped = 0;
  const push = (t: string) => {
    if (!t) return;
    const n = Number(t);
    if (Number.isFinite(n)) values.push(n);
    else skipped++;
  };
  for (const raw of text.split(/[\s;]+/)) {
    if (!raw) continue;
    // Keep thousand-separated numbers whole: 1,234,567.5 is one value.
    if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)) {
      push(raw.replace(/,/g, ''));
      continue;
    }
    for (const piece of raw.split(',')) push(piece);
  }
  return { values, skipped };
}

function fmt(n: number | null | undefined, decimals: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'n/a';
  let fixed = n.toFixed(decimals);
  if (fixed.includes('.')) fixed = fixed.replace(/\.?0+$/, '');
  if (fixed === '' || fixed === '-') fixed = '0';
  return fixed;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[], sorted: number[] = values): number {
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

function mode(values: number[]): { text: string; present: boolean } {
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  const max = Math.max(...freq.values(), 1);
  if (max === 1) return { text: 'none', present: false };
  const modes = [...freq.entries()]
    .filter(([, f]) => f === max)
    .map(([v]) => v)
    .sort((a, b) => a - b);
  return { text: modes.join(', '), present: true };
}

function variance(values: number[], spread: 'sample' | 'population'): number | null {
  const n = values.length;
  const denom = spread === 'population' ? n : n - 1;
  if (denom < 1) return null;
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / denom;
}

/** Quantile with linear interpolation on the sorted array (Excel INC / numpy default). */
function quantileInclusive(sorted: number[], p: number): number {
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo]! + (rank - lo) * (sorted[hi]! - sorted[lo]!);
}

/** Exclusive quantile (Excel EXC). Returns null outside the valid range. */
function quantileExclusive(sorted: number[], p: number): number | null {
  const rank = p * (sorted.length + 1);
  if (rank < 1 || rank > sorted.length) return null;
  const lo = Math.floor(rank) - 1;
  const hi = Math.ceil(rank) - 1;
  const frac = rank - 1 - lo;
  return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rawDecimals = Number(o.decimals);
  const decimals = Number.isFinite(rawDecimals)
    ? Math.max(0, Math.min(12, Math.trunc(rawDecimals)))
    : 4;

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Enter a list of numbers to analyse.',
      'Separate values with commas, spaces or new lines — for example: 2, 4, 4, 4, 5, 5, 7, 9',
    );
  }

  const { values, skipped } = parseNumbers(text);
  if (values.length === 0) {
    throw new ToolError(
      'No numbers found in the input.',
      'Type numbers separated by commas, spaces or new lines.',
    );
  }

  const spread = String(o.spread) === 'population' ? ('population' as const) : ('sample' as const);
  const method =
    String(o.quartiles) === 'exclusive' ? ('exclusive' as const) : ('inclusive' as const);

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / n;
  const med = median(values, sorted);
  const modeInfo = mode(values);
  const varv = variance(values, spread);
  const sd = varv === null ? null : Math.sqrt(varv);
  const sem = sd === null ? null : sd / Math.sqrt(n);
  const cv = avg !== 0 ? (sd === null ? null : (sd / avg) * 100) : null;
  const min = sorted[0]!;
  const max = sorted[n - 1]!;

  const q1 =
    method === 'exclusive' ? quantileExclusive(sorted, 0.25) : quantileInclusive(sorted, 0.25);
  const q3 =
    method === 'exclusive' ? quantileExclusive(sorted, 0.75) : quantileInclusive(sorted, 0.75);
  const iqr = q1 !== null && q3 !== null ? q3 - q1 : null;
  const lowerFence = iqr === null ? null : q1! - 1.5 * iqr;
  const upperFence = iqr === null ? null : q3! + 1.5 * iqr;
  const outliersList = iqr === null ? [] : sorted.filter((v) => v < lowerFence! || v > upperFence!);

  const allPositive = values.every((v) => v > 0);
  const geo = allPositive
    ? Math.exp((1 / n) * values.reduce((acc, v) => acc + Math.log(v), 0))
    : null;
  const harm = allPositive ? n / values.reduce((acc, v) => acc + 1 / v, 0) : null;

  const rows: Row[] = [
    ['Count (n)', String(n)],
    ['Sum', fmt(total, decimals)],
    ['Mean (arithmetic)', fmt(avg, decimals)],
    ['Median', fmt(med, decimals)],
    ['Mode', modeInfo.text],
    ['Minimum', fmt(min, decimals)],
    ['Maximum', fmt(max, decimals)],
    ['Range', fmt(max - min, decimals)],
    ['Q1 (first quartile)', fmt(q1, decimals)],
    ['Q3 (third quartile)', fmt(q3, decimals)],
    ['IQR', fmt(iqr, decimals)],
    ['Lower fence (Q1 - 1.5*IQR)', fmt(lowerFence, decimals)],
    ['Upper fence (Q3 + 1.5*IQR)', fmt(upperFence, decimals)],
    ['Outliers (Tukey)', outliersList.length ? outliersList.join(', ') : 'none'],
    ['Variance', fmt(varv, decimals)],
    ['Standard deviation', fmt(sd, decimals)],
    ['Standard error of mean', fmt(sem, decimals)],
    ['Coefficient of variation', cv === null ? 'n/a' : `${fmt(cv, decimals)}%`],
    ['Geometric mean', fmt(geo, decimals)],
    ['Harmonic mean', fmt(harm, decimals)],
  ];

  const notes: string[] = [];
  notes.push(
    `Statistics use the ${spread} formula for variance and standard deviation${spread === 'sample' ? ' (Bessel correction, n - 1)' : ''}.`,
  );
  if (skipped > 0)
    notes.push(`${skipped} non-numeric token${skipped === 1 ? '' : 's'} were ignored.`);
  if (!allPositive)
    notes.push('Geometric and harmonic means are reported when every value is positive.');
  if (outliersList.length)
    notes.push(
      `${outliersList.length} outlier${outliersList.length === 1 ? '' : 's'} fall outside the Tukey fences.`,
    );

  return {
    output: JSON.stringify({ headers: ['Statistic', 'Value'], rows }),
    render: 'table',
    stats: {
      n,
      mean: Number(avg.toFixed(decimals)),
      sd: sd === null ? 'n/a' : Number(sd.toFixed(decimals)),
      outliers: outliersList.length,
      mode: modeInfo.text,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
