import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ipv6-expander.meta';

const HEX = '0123456789abcdef';
const HEXET_RE = /^[0-9a-fA-F]{1,4}$/;

type Expansion = { hextets: string[]; issue: string };

function expandText(raw: string): Expansion {
  const text = raw.trim();
  const zoneIdx = text.indexOf('%');
  const zone = zoneIdx >= 0 ? text.slice(zoneIdx) : '';
  let addr = zoneIdx >= 0 ? text.slice(0, zoneIdx) : text;
  if (zone && !/^%[0-9A-Za-z._-]+$/.test(zone)) return { hextets: [], issue: 'Invalid zone identifier after %.' };
  if (addr.includes('.')) {
    const dot = /^(.*):(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
    if (!dot) return { hextets: [], issue: 'An IPv4 tail must be four dot-separated octets at the end (0–255).' };
    const octets = dot[2]!.split('.').map((x) => Number(x));
    if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return { hextets: [], issue: 'IPv4 octets must be between 0 and 255.' };
    const hexByte = (b: number) => HEX[(b >> 4) & 15]! + HEX[b & 15]!;
    const tail = `${hexByte(octets[0]!)}${hexByte(octets[1]!)}:${hexByte(octets[2]!)}${hexByte(octets[3]!)}`;
    addr = `${dot[1]}${dot[1] ? ':' : ''}${tail}`;
  }
  const halves = addr.split('::');
  if (halves.length > 2) return { hextets: [], issue: 'The :: shorthand may appear at most once.' };
  const left = halves[0]!.split(':').filter((s) => s !== '');
  const right = (halves[1] ?? '').split(':').filter((s) => s !== '');
  const total = left.length + right.length;
  if (halves.length === 1) {
    if (total !== 8) return { hextets: [], issue: `Expected 8 hextets; found ${total}.` };
  } else if (total >= 8) {
    return { hextets: [], issue: ':: cannot represent a run of zero hextets when the address already has 8 or more.' };
  }
  const parts = [...left, ...(halves.length === 2 ? Array(8 - total).fill('0000') : []), ...right];
  for (const [i, part] of parts.entries()) {
    const p = part as string;
    if (!HEXET_RE.test(p)) return { hextets: [], issue: `Invalid hextet at position ${i + 1}: "${p}".` };
    parts[i] = p.toLowerCase().padStart(4, '0');
  }
  return { hextets: parts as string[], issue: '' };
}

function compress(hextets: string[]): string {
  const stripped = hextets.map((h) => h.replace(/^0+(?=.)/, ''));
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < hextets.length; i++) {
    if (hextets[i] !== '0000') continue;
    let j = i;
    while (j < hextets.length && hextets[j] === '0000') j++;
    if (j - i > bestLen) { bestLen = j - i; bestStart = i; }
  }
  if (bestLen < 2) return stripped.join(':');
  const left = stripped.slice(0, bestStart).join(':');
  const right = stripped.slice(bestStart + bestLen).join(':');
  return `${left}::${right}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (!['expand', 'compress', 'validate'].includes(mode)) throw new ToolError('Choose a supported mode (expand, compress, or validate).');
  const raw = input.text.trim();
  if (!raw) return { output: JSON.stringify({ headers: ['IPv6', 'Result', 'Assessment'], rows: [] as string[][] }), render: 'table', notes: ['Paste an IPv6 address to expand or validate, e.g. 2001:db8::1.'] };
  const lines = raw.split(/[\s,]+/).filter((s) => s);
  const rows: string[][] = lines.map((line) => {
    const exp = expandText(line);
    return [line, exp.issue ? 'Invalid' : 'Valid', exp.issue || 'Well-formed address'];
  });
  if (lines.length > 1) {
    return { output: JSON.stringify({ headers: ['IPv6', 'Result', 'Assessment'], rows }), render: 'table', stats: { addresses: lines.length }, notes: ['Bulk mode: each space/comma-separated address is validated individually.'] };
  }
  const exp = expandText(raw);
  if (exp.issue) {
    return { output: JSON.stringify({ headers: ['IPv6', 'Result', 'Assessment'], rows: [[raw, 'Invalid', exp.issue]] }), render: 'table', stats: { valid: 'no' }, notes: [exp.issue, 'Valid IPv6 uses up to 8 hextets of hex digits, at most one ::, and may end with an IPv4-mapped tail.'] };
  }
  if (mode === 'expand') {
    return { output: exp.hextets.join(':'), render: 'code', language: 'text', filename: 'ipv6-expanded.txt', stats: { valid: 'yes', expanded: exp.hextets.join(':') }, notes: ['Expanded to its full zero-padded 8-hextet form.'] };
  }
  if (mode === 'compress') {
    const compressed = compress(exp.hextets);
    return { output: compressed, render: 'code', language: 'text', filename: 'ipv6-compressed.txt', stats: { valid: 'yes', original: exp.hextets.join(':'), compressed }, notes: ['Best-effort :: compression of the longest run of zero hextets.'] };
  }
  const mapped = raw.includes('.');
  const zone = raw.includes('%');
  return {
    output: JSON.stringify({ headers: ['Attribute', 'Value'], rows: [['Syntax', 'Valid'], ['Expanded form', exp.hextets.join(':')], ['IPv4-mapped', mapped ? 'yes' : 'no'], ['Zone id', zone ? 'present' : 'none']] }),
    render: 'table',
    stats: { valid: 'yes' },
    notes: ['The input is a well-formed IPv6 address.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
