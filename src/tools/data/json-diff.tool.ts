import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-diff.meta';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function kindOf(v: Json): 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v as 'object' | 'string' | 'number' | 'boolean';
}

function deepEqual(a: Json, b: Json): boolean {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka !== kb) return false;
  if (ka === 'array') {
    const aa = a as Json[];
    const bb = b as Json[];
    if (aa.length !== bb.length) return false;
    return aa.every((x, i) => deepEqual(x, bb[i]!));
  }
  if (ka === 'object') {
    const ao = a as { [k: string]: Json };
    const bo = b as { [k: string]: Json };
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    return ak.every(
      (k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k]!, bo[k]!),
    );
  }
  return a === b;
}

const fmt = (v: Json): string => JSON.stringify(v);

interface DiffState {
  lines: string[];
  added: number;
  removed: number;
  changed: number;
}

function walk(a: Json, b: Json, path: string, st: DiffState, ignoreArrayOrder: boolean): void {
  if (deepEqual(a, b)) return;

  const ka = kindOf(a);
  const kb = kindOf(b);

  if (ka !== kb || (ka !== 'object' && ka !== 'array')) {
    st.lines.push(`- ${path}: ${fmt(a)}`);
    st.lines.push(`+ ${path}: ${fmt(b)}`);
    st.changed++;
    return;
  }

  if (ka === 'object') {
    const ao = a as { [k: string]: Json };
    const bo = b as { [k: string]: Json };
    const keys = Array.from(new Set([...Object.keys(ao), ...Object.keys(bo)])).sort();
    for (const k of keys) {
      const p = `${path}.${k}`;
      const inA = Object.prototype.hasOwnProperty.call(ao, k);
      const inB = Object.prototype.hasOwnProperty.call(bo, k);
      if (inA && !inB) {
        st.lines.push(`- ${p}: ${fmt(ao[k]!)}`);
        st.removed++;
      } else if (!inA && inB) {
        st.lines.push(`+ ${p}: ${fmt(bo[k]!)}`);
        st.added++;
      } else {
        walk(ao[k]!, bo[k]!, p, st, ignoreArrayOrder);
      }
    }
    return;
  }

  // both arrays
  const aa = a as Json[];
  const bb = b as Json[];

  if (ignoreArrayOrder) {
    const used = new Array(bb.length).fill(false);
    for (const av of aa) {
      const idx = bb.findIndex((bv, i) => !used[i] && deepEqual(av, bv));
      if (idx === -1) {
        st.lines.push(`- ${path}[*]: ${fmt(av)}`);
        st.removed++;
      } else {
        used[idx] = true;
      }
    }
    bb.forEach((bv, i) => {
      if (!used[i]) {
        st.lines.push(`+ ${path}[*]: ${fmt(bv)}`);
        st.added++;
      }
    });
    return;
  }

  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) {
    const p = `${path}[${i}]`;
    const inA = i < aa.length;
    const inB = i < bb.length;
    if (inA && !inB) {
      st.lines.push(`- ${p}: ${fmt(aa[i]!)}`);
      st.removed++;
    } else if (!inA && inB) {
      st.lines.push(`+ ${p}: ${fmt(bb[i]!)}`);
      st.added++;
    } else {
      walk(aa[i]!, bb[i]!, p, st, ignoreArrayOrder);
    }
  }
}

function parseSide(text: string, label: string): Json {
  try {
    return JSON.parse(text) as Json;
  } catch (e) {
    throw new ToolError(`Invalid JSON in ${label}.`, (e as Error).message);
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const a = parseSide(input.text, 'the first input (A)');
  const b = parseSide(String(o.second ?? '{}').trim() || '{}', 'the second input (B)');
  const ignoreArrayOrder = Boolean(o.ignoreArrayOrder);

  const st: DiffState = { lines: [], added: 0, removed: 0, changed: 0 };
  walk(a, b, '$', st, ignoreArrayOrder);

  const stats = { added: st.added, removed: st.removed, changed: st.changed };

  if (st.lines.length === 0) {
    return { output: '', render: 'diff', notes: ['No differences.'], stats };
  }

  return {
    output: st.lines.join('\n'),
    render: 'diff',
    filename: 'diff.txt',
    stats,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
