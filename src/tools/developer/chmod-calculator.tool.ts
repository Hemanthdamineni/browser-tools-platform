import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './chmod-calculator.meta';

interface Perm {
  r: boolean;
  w: boolean;
  x: boolean;
}

interface Model {
  owner: Perm;
  group: Perm;
  other: Perm;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

const OCTAL_RE = /^[0-7]{3,4}$/;
const SYMBODY_RE = /^[-r][-w][-xsS][-r][-w][-xsS][-r][-w][-xtT]$/;

type Kind = 'octal' | 'symbolic' | 'invalid';

function classify(s: string): Kind {
  if (OCTAL_RE.test(s)) return 'octal';
  if (s.length === 9 && SYMBODY_RE.test(s)) return 'symbolic';
  if (s.length === 10 && SYMBODY_RE.test(s.slice(1))) return 'symbolic';
  return 'invalid';
}

function bits(n: number): Perm {
  return { r: (n & 4) !== 0, w: (n & 2) !== 0, x: (n & 1) !== 0 };
}

function parseOctal(s: string): Model {
  const padded = s.length === 3 ? `0${s}` : s;
  const sp = padded.charCodeAt(0) - 48;
  const oo = padded.charCodeAt(1) - 48;
  const og = padded.charCodeAt(2) - 48;
  const ot = padded.charCodeAt(3) - 48;
  return {
    owner: bits(oo),
    group: bits(og),
    other: bits(ot),
    setuid: (sp & 4) !== 0,
    setgid: (sp & 2) !== 0,
    sticky: (sp & 1) !== 0,
  };
}

function parseSymbolic(input: string): Model {
  const s = input.length === 10 ? input.slice(1) : input;
  const c = [...s];
  const ox = c[2]!;
  const gx = c[5]!;
  const tx = c[8]!;
  return {
    owner: { r: c[0] === 'r', w: c[1] === 'w', x: ox === 'x' || ox === 's' },
    group: { r: c[3] === 'r', w: c[4] === 'w', x: gx === 'x' || gx === 's' },
    other: { r: c[6] === 'r', w: c[7] === 'w', x: tx === 'x' || tx === 't' },
    setuid: ox === 's' || ox === 'S',
    setgid: gx === 's' || gx === 'S',
    sticky: tx === 't' || tx === 'T',
  };
}

function octalDigit(p: Perm): number {
  return (p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0);
}

function toOctal(m: Model): string {
  const sp = (m.setuid ? 4 : 0) + (m.setgid ? 2 : 0) + (m.sticky ? 1 : 0);
  return `${sp}${octalDigit(m.owner)}${octalDigit(m.group)}${octalDigit(m.other)}`;
}

function classTriple(p: Perm, special: boolean, lower: string, upper: string): string {
  const rw = (p.r ? 'r' : '-') + (p.w ? 'w' : '-');
  let last: string;
  if (special) last = p.x ? lower : upper;
  else last = p.x ? 'x' : '-';
  return rw + last;
}

function toSymbolic(m: Model): string {
  return (
    classTriple(m.owner, m.setuid, 's', 'S') +
    classTriple(m.group, m.setgid, 's', 'S') +
    classTriple(m.other, m.sticky, 't', 'T')
  );
}

const yn = (b: boolean) => (b ? 'yes' : 'no');

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const raw = input.text.trim();
  const kind = classify(raw);
  const mode = String(o.mode);

  if (kind === 'invalid') {
    throw new ToolError(
      'Not a valid permission mode.',
      'Enter octal (e.g. 755 or 4755) or symbolic (e.g. rwxr-xr-x).',
    );
  }
  if (mode === 'to-symbolic' && kind !== 'octal') {
    throw new ToolError(
      'Octal → symbolic mode expects an octal input such as 755.',
      'Switch the direction option to auto, or enter an octal mode.',
    );
  }
  if (mode === 'to-octal' && kind !== 'symbolic') {
    throw new ToolError(
      'Symbolic → octal mode expects a symbolic input such as rwxr-xr-x.',
      'Switch the direction option to auto, or enter a symbolic mode.',
    );
  }

  const model = kind === 'octal' ? parseOctal(raw) : parseSymbolic(raw);
  const octal = toOctal(model);
  const symbolic = toSymbolic(model);

  const rows: string[][] = [
    [
      'Owner',
      yn(model.owner.r),
      yn(model.owner.w),
      yn(model.owner.x),
      model.setuid ? 'setuid' : '-',
    ],
    [
      'Group',
      yn(model.group.r),
      yn(model.group.w),
      yn(model.group.x),
      model.setgid ? 'setgid' : '-',
    ],
    [
      'Other',
      yn(model.other.r),
      yn(model.other.w),
      yn(model.other.x),
      model.sticky ? 'sticky' : '-',
    ],
  ];

  return {
    output: JSON.stringify({
      headers: ['Class', 'Read', 'Write', 'Execute', 'Special'],
      rows,
    }),
    render: 'table',
    stats: {
      octal,
      'octal (3-digit)': octal.slice(1),
      symbolic,
      'ls style': `-${symbolic}`,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
