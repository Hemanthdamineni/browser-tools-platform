import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './barcode-validator.meta';

type Format = 'UPC-A' | 'UPC-E' | 'EAN-13' | 'EAN-8' | 'GTIN-14' | 'GTIN';
type Info = { format: Format; digits: string; prefix: string; country: string };
type Row = [string, string];

function normalize(inputLine: string): string {
  return inputLine.replace(/[^0-9]/g, '');
}

function gs1Check(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]!);
    // Alternating weights 3 and 1, starting with 3 on the rightmost digit.
    const weight = (digits.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** Identify format from a bare digit string (no check-digit verification). */
function formatOf(digits: string): Info | null {
  const len = digits.length;
  if (len === 12) {
    const dot = digits[0] === '0';
    return {
      format: dot ? 'UPC-A' : 'UPC-A',
      digits,
      prefix: digits.slice(0, 1),
      country: countryOf(digits.slice(0, 1)),
    };
  }
  if (len === 13) {
    let country = countryOf(digits.slice(0, 3));
    let prefix = digits.slice(0, 3);
    if (!country) {
      const p2 = countryOf(digits.slice(0, 2));
      if (p2) {
        prefix = digits.slice(0, 2);
        country = p2;
      } else {
        prefix = digits.slice(0, 1);
        country = countryOf(digits.slice(0, 1));
      }
    }
    return { format: 'EAN-13', digits, prefix, country };
  }
  if (len === 8) {
    let country = countryOf(digits.slice(0, 2));
    let prefix = digits.slice(0, 4);
    if (!country) {
      prefix = digits.slice(0, 1);
      country = countryOf(digits.slice(0, 1));
    }
    return { format: 'EAN-8', digits, prefix, country };
  }
  if (len === 6) {
    return {
      format: 'UPC-E',
      digits,
      prefix: digits.slice(0, 1),
      country: countryOf(digits.slice(0, 1)),
    };
  }
  if (len === 14)
    return {
      format: 'GTIN-14',
      digits,
      prefix: digits.slice(0, 1),
      country: countryOf(digits.slice(0, 1)),
    };
  if (len >= 1 && len <= 14)
    return {
      format: 'GTIN',
      digits,
      prefix: digits.slice(0, 1),
      country: countryOf(digits.slice(0, 1)),
    };
  return null;
}

/** GS1 numeric system prefixes → country/region group. Partial list, keys sorted by prefix. */
function countryOf(prefix: string): string {
  const table: [string, string][] = [
    ['000', 'US / Canada'],
    ['030', 'US / Canada'],
    ['039', 'US / Canada'],
    ['060', 'US / Canada'],
    ['100', 'US / Canada'],
    ['139', 'US / Canada'],
    ['200', 'Restricted distribution (GS1)'],
    ['299', 'Restricted distribution (GS1)'],
    ['300', 'France'],
    ['379', 'France'],
    ['380', 'Bulgaria'],
    ['400', 'Germany'],
    ['440', 'Germany'],
    ['450', 'Japan'],
    ['490', 'Japan'],
    ['460', 'Russia'],
    ['469', 'Russia'],
    ['470', 'Kyrgyzstan'],
    ['474', 'Estonia'],
    ['475', 'Latvia'],
    ['476', 'Azerbaijan'],
    ['477', 'Lithuania'],
    ['478', 'Uzbekistan'],
    ['479', 'Sri Lanka'],
    ['480', 'Philippines'],
    ['481', 'Belarus'],
    ['482', 'Ukraine'],
    ['484', 'Moldova'],
    ['485', 'Armenia'],
    ['486', 'Georgia'],
    ['487', 'Kazakhstan'],
    ['489', 'Hong Kong'],
    ['500', 'United Kingdom'],
    ['509', 'United Kingdom'],
    ['520', 'Greece'],
    ['521', 'Cyprus'],
    ['528', 'Lebanon'],
    ['529', 'Cyprus'],
    ['530', 'Albania'],
    ['531', 'North Macedonia'],
    ['535', 'Malta'],
    ['539', 'Ireland'],
    ['540', 'Belgium / Luxembourg'],
    ['549', 'Belgium / Luxembourg'],
    ['560', 'Portugal'],
    ['569', 'Portugal'],
    ['570', 'Denmark'],
    ['579', 'Denmark'],
    ['580', 'Iceland'],
    ['590', 'Poland'],
    ['594', 'Romania'],
    ['599', 'Hungary'],
    ['600', 'South Africa'],
    ['601', 'South Africa'],
    ['608', 'Bahrain'],
    ['609', 'Mauritius'],
    ['611', 'Morocco'],
    ['613', 'Algeria'],
    ['615', 'Nigeria'],
    ['616', 'Kenya'],
    ['618', 'Ivory Coast'],
    ['619', 'Tunisia'],
    ['620', 'Tanzania'],
    ['621', 'Syria'],
    ['622', 'Egypt'],
    ['624', 'Libya'],
    ['625', 'Jordan'],
    ['626', 'Iran'],
    ['627', 'Kuwait'],
    ['628', 'Saudi Arabia'],
    ['629', 'United Arab Emirates'],
    ['630', 'Qatar'],
    ['631', 'Namibia'],
    ['640', 'Finland'],
    ['649', 'Finland'],
    ['690', 'China'],
    ['699', 'China'],
    ['700', 'Norway'],
    ['709', 'Norway'],
    ['730', 'Sweden'],
    ['739', 'Sweden'],
    ['740', 'Guatemala'],
    ['741', 'El Salvador'],
    ['742', 'Honduras'],
    ['743', 'Nicaragua'],
    ['744', 'Costa Rica'],
    ['745', 'Panama'],
    ['746', 'Dominican Republic'],
    ['750', 'Mexico'],
    ['754', 'Canada'],
    ['755', 'Canada'],
    ['760', 'Switzerland'],
    ['769', 'Switzerland'],
    ['770', 'Colombia'],
    ['779', 'Argentina'],
    ['780', 'Chile'],
    ['784', 'Paraguay'],
    ['786', 'Ecuador'],
    ['789', 'Brazil'],
    ['790', 'Peru'],
    ['794', 'Peru'],
    ['800', 'Italy'],
    ['839', 'Italy'],
    ['840', 'Spain'],
    ['849', 'Spain'],
    ['850', 'Cuba'],
    ['858', 'Slovakia'],
    ['859', 'Czech Republic'],
    ['860', 'Serbia / Montenegro'],
    ['865', 'Serbia / Montenegro'],
    ['867', 'North Korea'],
    ['868', 'Turkey'],
    ['869', 'Turkey'],
    ['870', 'Netherlands'],
    ['879', 'Netherlands'],
    ['880', 'South Korea'],
    ['884', 'Cambodia'],
    ['885', 'Thailand'],
    ['888', 'Singapore'],
    ['890', 'India'],
    ['893', 'Vietnam'],
    ['896', 'Pakistan'],
    ['899', 'Indonesia'],
    ['900', 'Austria'],
    ['919', 'Austria'],
    ['930', 'Australia'],
    ['939', 'Australia'],
    ['940', 'New Zealand'],
    ['949', 'New Zealand'],
    ['950', 'GS1 global office'],
    ['955', 'Malaysia'],
    ['957', 'Macau'],
    ['958', 'Hong Kong'],
    ['960', 'Global office (GTIN-8)'],
    ['969', 'Global office (GTIN-8)'],
  ];
  if (prefix.length === 1) return countryByOne(prefix);
  const three = table.find(([k]) => k === prefix.slice(0, 3));
  if (three) return three[1];
  const falls = table.find(([k]) => prefix.startsWith(k));
  return falls ? falls[1] : '';
}

function countryByOne(prefix: string): string {
  const map: Record<string, string> = {
    '0': 'US / Canada',
    '1': 'US / Canada',
    '2': 'Restricted distribution',
    '3': 'France / Bulgaria / parts of Europe',
    '4': 'Germany / Japan / Russia / parts of Asia',
    '5': 'United Kingdom / Scandinavia / Eastern Europe',
    '6': 'China / South Africa / parts of Middle East',
    '7': 'South America / Mexico / Scandinavian countries',
    '8': 'Italy / Spain / Asia-Pacific',
    '9': 'Austria / Australia / New Zealand',
  };
  return map[prefix] ?? '';
}

/** Validate a full barcode: format-specific length + GS1 check digit. */
function validate(bare: string): {
  valid: boolean;
  reason: string;
  info: Info | null;
  code: string;
} {
  const digits = normalize(bare);
  const info = formatOf(digits);
  if (!info) {
    return {
      valid: false,
      reason: `"${digits}" is not a standard GTIN length (6, 8, 12, 13 or 14 digits).`,
      info: null,
      code: digits,
    };
  }
  const expected = gs1Check(digits.slice(0, -1));
  const actual = Number(digits[digits.length - 1]);
  const ok = expected === actual;
  return {
    valid: ok,
    reason: ok
      ? `Check digit ${actual} matches.`
      : `Check digit ${actual} does not match expected ${expected}.`,
    info,
    code: digits,
  };
}

function buildRows(info: Info | null, extra: Row[]): Row[] {
  const rows: Row[] = [];
  if (!info) return rows;
  rows.push(['Format', info.format]);
  rows.push(['Number of digits', String(info.digits.length)]);
  rows.push(['Country group', info.country || 'Unknown']);
  rows.push(['Numeric system prefix', info.prefix]);
  rows.push(...extra);
  return rows;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const raw = input.text.trim();
  if (!raw) {
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }),
      render: 'table',
      notes: ['Paste a barcode number (UPC-A, UPC-E, EAN-13 or EAN-8) to validate it.'],
    };
  }
  const lines = raw.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  const digits = normalize(lines[0]!);
  if (!digits) throw new ToolError('The barcode must contain at least one digit.');

  if (mode === 'checkdigit') {
    if (digits.length < 2)
      throw new ToolError('Need at least one digit before the check digit to compute it.');
    const check = gs1Check(digits);
    const info = formatOf(digits);
    const full = `${digits}${check}`;
    const rows: Row[] = [
      ['Input digits', digits],
      ['Computed check digit', String(check)],
      ['Complete barcode', full],
    ];
    const data = buildRows(info, rows) as Row[];
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows: data }),
      render: 'table',
      stats: { checkDigit: check, digits: digits.length, ...(info ? { format: info.format } : {}) },
      notes: ['The check digit is computed with the GS1 mod-10 (weights 3 and 1) scheme.'],
    };
  }

  const result = validate(raw);
  const rows: Row[] = [];
  if (result.info) rows.push(['Format', result.info.format]);
  if (result.info) rows.push(['Number of digits', String(result.info.digits.length)]);
  if (result.info) rows.push(['Country group', result.info.country || 'Unknown']);
  if (result.info) rows.push(['Numeric system prefix', result.info.prefix]);
  rows.push(['Check digit', result.info ? result.info.digits[result.info.digits.length - 1]! : '']);
  rows.push(['Result', result.reason]);
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: { valid: result.valid ? 1 : 0, ...(result.info ? { format: result.info.format } : {}) },
    notes: [
      result.valid
        ? 'Valid GS1 barcode — the weighted check digit matches.'
        : 'This barcode failed validation. Check for a typo or a swapped digit.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
