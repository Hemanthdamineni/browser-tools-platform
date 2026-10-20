import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './luhn-validator.meta';

function digits(value: string): { list: number[]; raw: string } | { list: null; raw: string } {
  const raw = value.replace(/\s+/g, '').replace(/[-]/g, '');
  if (!/^\d+$/.test(raw)) return { list: null, raw };
  return { list: raw.split('').map((c) => Number(c)), raw };
}

function luhnSum(list: number[]): number {
  let sum = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    let d = list[i]!;
    if ((list.length - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum;
}

function baseSum(base: number[]): number {
  // base excludes the check digit, so its rightmost digit is doubled (it
  // becomes the second-from-right in the full number).
  let sum = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    let d = base[i]!;
    if ((base.length - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum;
}

function checkDigit(base: number[]): number {
  return (10 - (baseSum(base) % 10)) % 10;
}

function networkHint(raw: string): string {
  if (/^4/.test(raw)) return 'Visa (starts with 4)';
  if (/^5[1-5]/.test(raw)) return 'Mastercard (51–55)';
  if (/^6(?:011|5)/.test(raw)) return 'Discover (6011/65)';
  if (/^3[47]/.test(raw)) return 'American Express (34/37)';
  return '';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (!['validate', 'check-digit', 'generate'].includes(mode)) throw new ToolError('Choose a supported mode (validate, check-digit, or generate).');
  const source = input.text.trim();
  if (!source) return { output: JSON.stringify({ headers: ['Mode', 'Input', 'Result'], rows: [] as string[][] }), render: 'table', notes: ['Paste a number to validate with the Luhn mod-10 algorithm.'] };
  const parsed = digits(source);
  if (parsed.list === null) throw new ToolError('Input must contain only digits, spaces, and dashes.');
  const list = parsed.list;
  if (mode === 'validate') {
    if (list.length < 2) throw new ToolError('A Luhn number needs at least two digits.');
    const ok = luhnSum(list) % 10 === 0;
    const hint = networkHint(parsed.raw);
    const rows = [[source, ok ? 'Valid' : 'Invalid', ok ? (hint || 'Luhn checksum passes') : luhnSum(list) % 10 === 0 ? '' : `Checksum remainder is ${luhnSum(list) % 10}`]];
    return { output: JSON.stringify({ headers: ['Input', 'Result', 'Detail'], rows }), render: 'table', stats: { digitCount: list.length, valid: ok ? 'yes' : 'no', network: hint || 'unknown' }, notes: [ok ? (hint ? `Matches ${hint}; passes the Luhn check.` : 'Passes the Luhn check.') : 'Fails the Luhn check — likely a typo in the digits.'] };
  }
  if (mode === 'check-digit') {
    const expected = checkDigit(list);
    const rows = [[source, String(expected), `Pad with ${expected} to make the sum a multiple of 10.`]];
    return { output: JSON.stringify({ headers: ['Input', 'Check digit', 'Note'], rows }), render: 'table', stats: { digitCount: list.length, checkDigit: expected }, notes: [`Expected check digit: ${expected}.`] };
  }
  const expected = checkDigit(list);
  const generated = list.join('') + String(expected);
  return { output: generated, render: 'code', language: 'text', filename: 'luhn-generated.txt', stats: { checkDigit: expected, length: generated.length }, notes: [`Generated ${parsed.raw} + check digit ${expected}.`] };
}

const tool: TextToolModule = { meta, run };
export default tool;
