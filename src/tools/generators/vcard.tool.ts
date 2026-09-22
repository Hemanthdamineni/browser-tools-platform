import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './vcard.meta';

/** RFC 6350-style escaping for structured text values. */
const escape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unescape = (s: string) =>
  s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

const FIELD_PROPS = ['N', 'FN', 'ORG', 'TITLE', 'EMAIL', 'TEL', 'URL', 'ADR', 'NOTE'] as const;
const FIELD_LABELS: Record<string, string> = {
  N: 'Name (structured)',
  FN: 'Full name',
  ORG: 'Organization',
  TITLE: 'Job title',
  EMAIL: 'Email',
  TEL: 'Phone',
  URL: 'Website',
  ADR: 'Address',
  NOTE: 'Note',
};

export function buildVcard(f: {
  firstName?: string;
  lastName?: string;
  org?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  note?: string;
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escape(f.lastName ?? '')};${escape(f.firstName ?? '')};;;`,
  ];
  const fn = `${f.firstName ?? ''} ${f.lastName ?? ''}`.trim();
  if (fn) lines.push(`FN:${escape(fn)}`);
  if (f.org) lines.push(`ORG:${escape(f.org)}`);
  if (f.jobTitle) lines.push(`TITLE:${escape(f.jobTitle)}`);
  if (f.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(f.email)}`);
  if (f.phone) lines.push(`TEL;TYPE=CELL:${escape(f.phone)}`);
  if (f.website) lines.push(`URL:${escape(f.website)}`);
  if (f.address) lines.push(`ADR;TYPE=HOME:;;${escape(f.address)};;;;`);
  if (f.note) lines.push(`NOTE:${escape(f.note)}`);
  lines.push('END:VCARD');
  return lines.join('\n') + '\n';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  if (String(o.mode) === 'parse') {
    const text = input.text;
    if (!text.trim()) return { output: '' };
    const rows: string[][] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line === 'BEGIN:VCARD' || line === 'END:VCARD') continue;
      const m = /^([^:;]+)((?:;[^:]*)*):(.*)$/.exec(line);
      if (!m) continue;
      const prop = m[1]!.toUpperCase();
      if (!FIELD_PROPS.includes(prop as (typeof FIELD_PROPS)[number])) continue;
      rows.push([FIELD_LABELS[prop] ?? prop, unescape(m[3] ?? '')]);
    }
    if (rows.length === 0) {
      throw new ToolError(
        'That is not a vCard.',
        'Paste text that contains BEGIN:VCARD … END:VCARD lines.',
      );
    }
    return {
      output: JSON.stringify({ headers: ['Field', 'Value'], rows }),
      render: 'table',
      stats: { fields: rows.length },
    };
  }

  const fields = {
    firstName: String(o.firstName ?? '').trim(),
    lastName: String(o.lastName ?? '').trim(),
    org: String(o.org ?? '').trim(),
    jobTitle: String(o.jobTitle ?? '').trim(),
    email: String(o.email ?? '').trim(),
    phone: String(o.phone ?? '').trim(),
    website: String(o.website ?? '').trim(),
    address: String(o.address ?? '').trim(),
    note: String(o.note ?? '').trim(),
  };
  if (!fields.firstName && !fields.lastName && !fields.email && !fields.org) {
    throw new ToolError('Fill in at least a name or email.');
  }
  const output = buildVcard(fields);
  return {
    output,
    render: 'code',
    filename: 'contact.vcf',
    language: 'text',
    stats: { version: '3.0' },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
