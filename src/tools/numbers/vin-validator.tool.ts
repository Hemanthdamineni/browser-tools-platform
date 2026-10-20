import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './vin-validator.meta';

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const TRANS: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};
const YEAR: Record<string, string> = {
  A: '1980',
  B: '1981',
  C: '1982',
  D: '1983',
  E: '1984',
  F: '1985',
  G: '1986',
  H: '1987',
  J: '1988',
  K: '1989',
  L: '1990',
  M: '1991',
  N: '1992',
  P: '1993',
  R: '1994',
  S: '1995',
  T: '1996',
  V: '1997',
  W: '1998',
  X: '1999',
  Y: '2000',
  1: '2001',
  2: '2002',
  3: '2003',
  4: '2004',
  5: '2005',
  6: '2006',
  7: '2007',
  8: '2008',
  9: '2009',
};

function parseVin(raw: string): string[] {
  const cleaned = raw.trim().toUpperCase();
  const issues: string[] = [];
  if (!/^[A-Z0-9]{17}$/.test(cleaned)) {
    if (cleaned.length !== 17)
      issues.push(`A VIN must be exactly 17 characters; found ${cleaned.length}.`);
    const bad = [...new Set(cleaned.replace(/[^A-Z0-9]/g, '').match(/[IOQ]/g) ?? [])];
    if (bad.length)
      issues.push(`Illegal characters (I, O, Q) are not allowed in a VIN: ${bad.join(', ')}`);
    return issues;
  }
  const illegal = cleaned.match(/[IOQ]/g);
  if (illegal)
    issues.push(
      `Illegal characters (I, O, Q) are not allowed: ${[...new Set(illegal)].join(', ')}`,
    );
  const digits: number[] = cleaned
    .split('')
    .map((c) => (c === 'X' ? 10 : /\d/.test(c) ? Number(c) : (TRANS[c] ?? 0)));
  const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i]!, 0);
  const expected = sum % 11;
  const actual = cleaned[8] === 'X' ? 10 : cleaned[8] ? Number(cleaned[8]) : NaN;
  const ok = !isNaN(expected) && expected === actual;
  if (!ok)
    issues.push(
      `Check digit mismatch: expected ${expected === 10 ? 'X' : expected}, found ${cleaned[8]}.`,
    );
  return issues;
}

function wmiRegion(wmi: string): string {
  const first = wmi[0] ?? '';
  if (['1', '4', '5'].includes(first)) return 'North America';
  if (['2', '3'].includes(first)) return 'Canada';
  if (['6', '7'].includes(first)) return 'Oceania';
  if (['8', '9'].includes(first)) return 'South America';
  if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(first)) return 'Africa';
  if (first === 'J') return 'Japan';
  if (first === 'K' || first === 'L') return 'South Korea';
  if (first === 'M' || first === 'N' || first === 'P') return 'India, Pakistan, Middle East';
  if (first === 'R') return 'Russia';
  if (first === 'S') return 'United Kingdom';
  if (first === 'T') return 'Switzerland';
  if (first === 'V') return 'France';
  if (first === 'W') return 'Germany';
  if (first === 'X') return 'Northern Europe';
  if (first === 'Y') return 'Belgium, Luxembourg';
  if (first === 'Z') return 'Italy';
  if (first === '0') return 'Unknown';
  return 'Unknown';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (!['decode', 'validate', 'generate'].includes(mode))
    throw new ToolError('Choose a supported mode (decode, validate, or generate).');
  const raw = input.text.trim();
  if (!raw)
    return {
      output: JSON.stringify({ headers: ['VIN', 'Result', 'Detail'], rows: [] as string[][] }),
      render: 'table',
      notes: ['Paste a 17-character VIN to validate and decode, e.g. 1HGCM82633A004352.'],
    };
  if (mode === 'generate') {
    const cleaned = raw.toUpperCase().replace(/\s+/g, '');
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      const padded = cleaned.trim();
      if (!/^[A-HJ-NPR-Z0-9]{16}$/.test(padded.padEnd(16, '0').slice(0, 16)))
        throw new ToolError(
          'Give the first 16 characters (a valid VIN prefix with position 9 as 0), and the check digit is computed.',
        );
    }
    const withZero =
      cleaned.length === 17
        ? cleaned.slice(0, 8) + '0' + cleaned.slice(9)
        : cleaned.padEnd(17, '0');
    const digits = withZero
      .slice(0, 17)
      .split('')
      .map((c, i) => (i === 8 ? 0 : /\d/.test(c) ? Number(c) : (TRANS[c] ?? 0)));
    const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i]!, 0);
    const expected = sum % 11;
    const check = expected === 10 ? 'X' : String(expected);
    const full = `${withZero.slice(0, 8)}${check}${withZero.slice(9, 17)}`;
    return {
      output: full,
      render: 'code',
      language: 'text',
      filename: 'vin-generated.txt',
      stats: { checkDigit: check },
      notes: [`Computed check digit ${check} from the 16-character body.`],
    };
  }
  const issues = parseVin(raw);
  if (mode === 'validate') {
    const ok = issues.length === 0;
    return {
      output: JSON.stringify({
        headers: ['VIN', 'Result', 'Detail'],
        rows: [
          [raw, ok ? 'Valid' : 'Invalid', issues.join('; ') || 'Check digit and length both pass'],
        ],
      }),
      render: 'table',
      stats: { valid: ok ? 'yes' : 'no' },
      notes: issues.length ? issues : ['VIN passes NHTSA structure and checksum rules.'],
    };
  }
  const cleaned = raw.trim().toUpperCase();
  const region = wmiRegion(cleaned.slice(0, 3));
  const yearCode = cleaned[9] ?? '';
  const modelYear = YEAR[yearCode]
    ? `${YEAR[yearCode]} (plus any 30-year interval)`
    : 'Unknown (check a year chart)';
  const rows = [
    ['WMI (1–3)', cleaned.slice(0, 3), region],
    ['VDS (4–8)', cleaned.slice(3, 8), 'Vehicle descriptor'],
    ['Check digit (9)', cleaned[8] ?? '-', issues.length ? 'Mismatch' : 'Passes'],
    ['Model year (10)', yearCode, modelYear],
    ['Plant (11)', cleaned[10] ?? '-', 'Assembly plant code'],
    ['Serial (12–17)', cleaned.length === 17 ? cleaned.slice(11, 17) : '-', 'Production sequence'],
  ];
  return {
    output: JSON.stringify({ headers: ['Position', 'Value', 'Meaning'], rows }),
    render: 'table',
    stats: { valid: issues.length ? 'no' : 'yes', region },
    notes: issues.length
      ? issues
      : [
          'VIN structure and check digit validated. WMI identifies manufacturer; the world manufacturer code is assigned by regional authorities.',
        ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
