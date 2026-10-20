import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './percentage-calculator.meta';

function fmt(n: number, max = 6): string {
  if (!Number.isFinite(n)) return 'undefined';
  if (Number.isInteger(n)) return String(n);
  const rounded = Number(n.toFixed(max));
  return String(rounded);
}

function parsePair(text: string): [number, number] {
  const parts = text
    .trim()
    .split(/[\s,;]+/)
    .filter((s) => s);
  if (parts.length !== 2)
    throw new ToolError('Enter exactly two numbers separated by a space or comma (e.g. "20 150").');
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new ToolError('Both values must be numbers.');
  return [a, b];
}

function money(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const source = input.text.trim();
  if (!source) {
    const guide: Record<string, string> = {
      'percent-of': 'Type as "20 150" for 20% of 150.',
      'percent-change': 'Type as "80 100" for the change from 80 to 100.',
      increase: 'Type as "50 15" for 50 increased by 15%.',
      decrease: 'Type as "50 15" for 50 decreased by 15%.',
    };
    return {
      output: JSON.stringify({ headers: ['Mode', 'Values', 'Result'], rows: [] as string[][] }),
      render: 'table',
      stats: { mode },
      notes: [guide[mode] ?? 'Enter two numbers separated by a space.'],
    };
  }
  const [first, second] = parsePair(source);
  if (mode === 'percent-of') {
    const result = (first / 100) * second;
    const rows = [
      [`${fmt(first)}% of ${fmt(second)}`, fmt(second) + ' × ' + fmt(first) + '/100', fmt(result)],
    ];
    return {
      output: JSON.stringify({ headers: ['Question', 'Steps', 'Answer'], rows }),
      render: 'table',
      stats: { percentage: first, value: second, result },
      notes: [`${fmt(first)}% of ${fmt(second)} is ${fmt(result)} (≈ ${money(result)}).`],
    };
  }
  if (mode === 'percent-change') {
    if (first === 0) throw new ToolError('Percent change from zero is undefined.');
    const change = ((second - first) / Math.abs(first)) * 100;
    const rows = [
      [
        `Change from ${fmt(first)} to ${fmt(second)}`,
        `(${fmt(second)} − ${fmt(first)}) ÷ |${fmt(first)}|`,
        fmt(change) + '%',
      ],
    ];
    return {
      output: JSON.stringify({ headers: ['Question', 'Steps', 'Answer'], rows }),
      render: 'table',
      stats: { from: first, to: second, percentChange: change },
      notes: [
        `${fmt(second)} is ${change >= 0 ? '+' : ''}${fmt(change)}% ${change >= 0 ? 'more' : 'less'} than ${fmt(first)}.`,
      ],
    };
  }
  // increase / decrease
  const percent = second;
  const factor = mode === 'increase' ? 1 + percent / 100 : 1 - percent / 100;
  const rawResult = first * factor;
  const result = Number(rawResult.toFixed(6));
  const rows = [
    [
      `${fmt(first)} ${mode === 'increase' ? 'increased' : 'decreased'} by ${fmt(percent)}%`,
      `${fmt(first)} × (1 ${mode === 'increase' ? '+' : '−'} ${fmt(percent)}/100)`,
      fmt(result),
    ],
  ];
  return {
    output: JSON.stringify({ headers: ['Question', 'Steps', 'Answer'], rows }),
    render: 'table',
    stats: { base: first, percent, result },
    notes: [
      `${fmt(first)} ${mode === 'increase' ? 'increased' : 'decreased'} by ${fmt(percent)}% is ${fmt(result)} (≈ ${money(result)}).`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
