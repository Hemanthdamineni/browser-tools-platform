import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './checksum-validator.meta';

type Check = { format: string; valid: boolean; normalized: string; detail: string };

function digitsOnly(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function luhn(value: string): Check {
  const normalized = digitsOnly(value);
  if (!/^\d{12,19}$/.test(normalized)) {
    return {
      format: 'Luhn',
      valid: false,
      normalized,
      detail: 'Expected 12–19 digits with optional spaces or hyphens.',
    };
  }
  let sum = 0;
  let double = false;
  for (let i = normalized.length - 1; i >= 0; i--) {
    let digit = Number(normalized[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return {
    format: 'Luhn',
    valid: sum % 10 === 0,
    normalized,
    detail: sum % 10 === 0 ? 'Checksum matches.' : 'Checksum does not match.',
  };
}

function iban(value: string): Check {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalized)) {
    return {
      format: 'IBAN',
      valid: false,
      normalized,
      detail: 'Expected 2 letters, 2 check digits, and 11–30 alphanumeric characters.',
    };
  }
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const expanded = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return {
    format: 'IBAN',
    valid: remainder === 1,
    normalized,
    detail:
      remainder === 1
        ? 'MOD-97 checksum matches.'
        : `MOD-97 remainder is ${remainder}, expected 1.`,
  };
}

function isbn(value: string): Check {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(normalized)) {
    const sum = [...normalized].reduce(
      (total, ch, index) => total + (ch === 'X' ? 10 : Number(ch)) * (10 - index),
      0,
    );
    const valid = sum % 11 === 0;
    return {
      format: 'ISBN-10',
      valid,
      normalized,
      detail: valid ? 'Weighted modulo-11 checksum matches.' : 'Modulo-11 checksum does not match.',
    };
  }
  if (/^\d{13}$/.test(normalized)) {
    const sum = [...normalized.slice(0, 12)].reduce(
      (total, ch, index) => total + Number(ch) * (index % 2 ? 3 : 1),
      0,
    );
    const expected = (10 - (sum % 10)) % 10;
    const valid = expected === Number(normalized[12]);
    return {
      format: 'ISBN-13',
      valid,
      normalized,
      detail: valid ? 'Weighted modulo-10 checksum matches.' : `Expected check digit ${expected}.`,
    };
  }
  return {
    format: 'ISBN',
    valid: false,
    normalized,
    detail: 'Expected 10 or 13 digits (ISBN-10 may end in X), with optional spaces or hyphens.',
  };
}

function detect(value: string): Check {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{2}/.test(normalized)) return iban(value);
  if (/^(?:\d{9}[\dX]|\d{13})$/.test(normalized)) return isbn(value);
  return luhn(value);
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format);
  if (!['auto', 'luhn', 'iban', 'isbn'].includes(format))
    throw new ToolError('Choose a supported identifier format.');

  const values = input.text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!values.length) {
    return {
      output: JSON.stringify({ headers: ['Input', 'Format', 'Result', 'Details'], rows: [] }),
      render: 'table',
      notes: ['Enter one identifier per line.'],
    };
  }

  const checks = values.map((value) => {
    if (format === 'luhn') return luhn(value);
    if (format === 'iban') return iban(value);
    if (format === 'isbn') return isbn(value);
    return detect(value);
  });
  const rows = checks.map((check) => [
    check.normalized,
    check.format,
    check.valid ? 'Valid checksum' : 'Invalid / unsupported',
    check.detail,
  ]);
  const validCount = checks.filter((check) => check.valid).length;
  return {
    output: JSON.stringify({ headers: ['Identifier', 'Format', 'Result', 'Details'], rows }),
    render: 'table',
    stats: {
      checked: checks.length,
      'valid checksums': validCount,
      'invalid / unsupported': checks.length - validCount,
    },
    notes: [
      'Checksum validity only detects some formatting or transcription errors. It does not verify that an account, card, or ISBN record exists or is active.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
