import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './credit-card-validator.meta';

const MAX_LEN = 64;

interface Brand {
  name: string;
  lengths: number[];
  check: (digits: string) => boolean;
}

const BRANDS: Brand[] = [
  { name: 'Visa', lengths: [13, 16, 19], check: (d) => d.startsWith('4') },
  { name: 'Mastercard', lengths: [16], check: (d) => /^(?:5[1-5]|2[2-7]\d{2})/.test(d) },
  { name: 'American Express', lengths: [15], check: (d) => /^(?:34|37)/.test(d) },
  { name: 'Discover', lengths: [16], check: (d) => /^(?:6011|65|64[4-9]|622[1-9]\d)/.test(d) },
  { name: 'Diners Club', lengths: [14], check: (d) => /^(?:30[0-5]|36|38|39)/.test(d) },
  { name: 'JCB', lengths: [16, 17, 18, 19], check: (d) => /^35(?:2[89]|[3-8]\d)/.test(d) },
  { name: 'UnionPay', lengths: [16, 17, 18, 19], check: (d) => d.startsWith('62') },
];

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let v = digits.charCodeAt(i) - 48;
    if (double) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    double = !double;
  }
  return sum % 10 === 0;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const strictLength = o.strictLength !== false;
  const source = (input.text ?? '').replace(/[\s-]/g, '');
  if (!source) throw new ToolError('Enter a card number to validate.', 'Example: 4111 1111 1111 1111');
  if (source.length > MAX_LEN) throw new ToolError('That is too long for a card number.');
  if (!/^\d+$/.test(source)) throw new ToolError('Only digits, spaces and dashes are allowed.');

  const headers = ['Check', 'Result'];
  const rows: string[][] = [];

  const sumValid = luhnValid(source);
  const brand = BRANDS.find((b) => b.check(source));
  rows.push(['Digits', String(source.length)]);
  rows.push(['Luhn checksum', sumValid ? 'Pass' : 'Fail']);
  rows.push(['Brand', brand ? brand.name : 'Unrecognised']);

  let overall = sumValid;
  if (brand) {
    const lenOk = brand.lengths.includes(source.length);
    rows.push(['Expected length', strictLength ? brand.lengths.join(' or ') : '—']);
    if (strictLength && !lenOk) {
      rows.push(['Length check', 'Fail (expected ' + brand.lengths.join(' or ') + ')']);
      overall = false;
    } else {
      rows.push(['Length check', 'Pass']);
    }
  }
  rows.push(['Result', overall ? 'Valid' : 'Invalid']);

  const notes: string[] = [
    sumValid ? 'The number passes the Luhn checksum.' : 'The number fails the Luhn checksum.',
    brand ? 'Brand detected from the IIN prefix.' : 'No known brand matches the prefix.',
    "This is a format check only — it does not confirm a real card exists.",
  ];

  return {
    output: JSON.stringify({ headers, rows }),
    render: 'table',
    stats: { digits: source.length, valid: overall ? 1 : 0 },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
