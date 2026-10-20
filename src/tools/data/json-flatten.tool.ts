import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-flatten.meta';

const MAX_DEPTH = 128;

type JsonValue = unknown;

interface Segment {
  name: string;
  idx: number | null;
}

interface PathSeg extends Segment {
  isIndex: boolean;
}

function buildKey(segs: PathSeg[], style: 'index' | 'bracket'): string {
  let out = '';
  for (const s of segs) {
    const label = s.idx !== null ? String(s.idx) : s.name;
    if (style === 'bracket' && s.isIndex) out += '[' + label + ']';
    else if (out === '') out += label;
    else out += '.' + label;
  }
  return out;
}

function flattenToPairs(
  node: JsonValue,
  path: PathSeg[],
  out: Array<[string, JsonValue]>,
  style: 'index' | 'bracket',
  depth: number,
): void {
  if (depth > MAX_DEPTH) {
    throw new ToolError(
      'Object is nested too deeply.',
      'Flattening stops beyond ' + MAX_DEPTH + ' levels.',
    );
  }
  if (node === null || typeof node !== 'object') {
    out.push([buildKey(path, style), node]);
    return;
  }
  const entries = Array.isArray(node)
    ? node.map((v, i) => [String(i), v] as const)
    : Object.entries(node);
  if (!entries.length) {
    out.push([buildKey(path, style), Array.isArray(node) ? [] : {}]);
    return;
  }
  for (const [k, v] of entries) {
    const isIndex = Array.isArray(node);
    const idx = /^\d+$/.test(k) ? Number(k) : null;
    flattenToPairs(v, [...path, { name: k, idx, isIndex }], out, style, depth + 1);
  }
}

function parsePath(path: string): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  while (i < path.length) {
    let name = '';
    while (i < path.length && path[i] !== '.' && path[i] !== '[') {
      name += path[i]!;
      i += 1;
    }
    if (name !== '') segs.push({ name, idx: null });
    while (i < path.length && path[i] === '[') {
      const close = path.indexOf(']', i);
      if (close === -1)
        throw new ToolError('Invalid array index in "' + path + '".', 'Expected [0], [1], …');
      const digits = path.slice(i + 1, close);
      if (!/^\d+$/.test(digits)) throw new ToolError('Invalid array index in "' + path + '".');
      segs.push({ name: '', idx: Number(digits) });
      i = close + 1;
    }
    if (i < path.length && path[i] === '.') i += 1;
  }
  if (!segs.length) throw new ToolError('Empty path: "' + path + '".');
  return segs;
}

interface Cell {
  children: Map<string | number, Cell>;
  value: JsonValue;
  hasValue: boolean;
}

function makeCell(): Cell {
  return { children: new Map(), value: undefined, hasValue: false };
}

function cellKey(seg: Segment): string | number {
  return seg.idx !== null ? seg.idx : seg.name;
}

function unflattenBuild(records: Array<[string, JsonValue]>): unknown {
  const root = makeCell();

  for (const [path, value] of records) {
    const segs = parsePath(path);
    let cur = root;
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s]!;
      const key = cellKey(seg);
      if (s === segs.length - 1) {
        if (cur.hasValue) {
          throw new ToolError('Cannot use "' + path + '" as both a value and an object.');
        }
        if (cur.children.has(key) && !cur.hasValue) {
          throw new ToolError('Cannot use "' + path + '" as both a value and an object.');
        }
        if (cur.children.has(key) && cur.hasValue) {
          throw new ToolError('Duplicate or conflicting path: "' + path + '".');
        }
        cur.children.set(key, makeCell());
        const leaf = cur.children.get(key)!;
        leaf.value = value;
        leaf.hasValue = true;
        continue;
      }
      if (cur.hasValue) {
        throw new ToolError('Cannot use "' + path + '" as both a value and an object.');
      }
      if (!cur.children.has(key)) cur.children.set(key, makeCell());
      cur = cur.children.get(key)!;
    }
  }

  const toJson = (cell: Cell): JsonValue => {
    if (cell.hasValue) return cell.value;
    if (cell.children.size === 0) return {};
    const anyIndex = [...cell.children.keys()].some((k) => typeof k === 'number');
    if (anyIndex) {
      // Bracket-style array indices or numeric dot keys: honour explicit arrays first.
      const arr: unknown[] = [];
      let max = -1;
      for (const k of cell.children.keys()) {
        if (typeof k === 'number') max = Math.max(max, k);
      }
      for (let i = 0; i <= max; i++) {
        const child = cell.children.get(i);
        arr[i] = child ? toJson(child) : null;
      }
      return arr;
    }
    const obj: Record<string, unknown> = {};
    for (const [k, child] of cell.children) obj[String(k)] = toJson(child);
    // Contiguous numeric keys become arrays (faithful round trip from dot-index style).
    const keys = Object.keys(obj);
    const numeric = keys.every((k) => /^\d+$/.test(k));
    if (numeric && keys.length) {
      const max = Math.max(...keys.map(Number));
      if (keys.length === max + 1) {
        const arr: unknown[] = [];
        for (let i = 0; i <= max; i++) arr[i] = obj[String(i)];
        return arr;
      }
    }
    return obj;
  };

  return toJson(root);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'flatten');
  const style = String(o.arrayStyle ?? 'index') === 'bracket' ? 'bracket' : 'index';
  const sorted = o.sorted === true;

  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste a JSON object to flatten or rebuild.');
  if (source.length > 1_000_000)
    throw new ToolError('JSON is too large.', 'Keep it under 1,000,000 characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ToolError('That is not valid JSON.', 'Fix the document and try again.');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new ToolError(
      'Flatten needs a JSON object or array.',
      'Primitive values have nothing to unfold.',
    );
  }

  if (mode === 'flatten') {
    const pairs: Array<[string, JsonValue]> = [];
    flattenToPairs(parsed, [], pairs, style, 0);
    const sortedPairs = sorted ? pairs.slice().sort((a, b) => a[0].localeCompare(b[0])) : pairs;
    const flat: Record<string, JsonValue> = {};
    for (const [k, v] of sortedPairs) flat[k] = v;
    const output = JSON.stringify(flat, null, 2) + '\n';
    const maxDepth = Math.max(0, ...pairs.map(([k]) => k.split('.').length));
    return {
      output,
      render: 'text',
      language: 'json',
      stats: { leaves: pairs.length, maxDepth },
      notes: [
        `Nested JSON flattened to ${pairs.length} dotted key${pairs.length === 1 ? '' : 's'}.`,
        'Switch direction to rebuild the nested object.',
      ],
    };
  }

  if (mode === 'unflatten') {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ToolError(
        'Unflatten expects an object of dotted keys.',
        'Example: { "server.host": "localhost" }',
      );
    }
    const records = Object.entries(parsed as Record<string, JsonValue>);
    const rebuilt = unflattenBuild(records);
    const output = JSON.stringify(rebuilt, null, 2) + '\n';
    return {
      output,
      render: 'text',
      language: 'json',
      stats: { leaves: records.length },
      notes: [
        `Rebuilt nested JSON from ${records.length} dotted key${records.length === 1 ? '' : 's'}.`,
      ],
    };
  }

  throw new ToolError('Unknown mode.');
}

const tool: TextToolModule = { meta, run };
export default tool;
