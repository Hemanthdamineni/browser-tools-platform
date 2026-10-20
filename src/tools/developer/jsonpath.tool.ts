import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './jsonpath.meta';

type D = unknown;

interface Ctx {
  cur: D;
  path: string;
}

const MAX_NODES = 1_000_000;

function addChild(out: Ctx[], parent: Ctx, key: string): void {
  const p = parent.cur;
  if (Array.isArray(p)) {
    const i = Number(key);
    if (i >= 0 && i < p.length) out.push({ cur: p[i]!, path: parent.path + '[' + i + ']' });
  } else if (p !== null && typeof p === 'object') {
    const v = (p as Record<string, D>)[key];
    if (v !== undefined) out.push({ cur: v, path: parent.path + '.' + key });
  }
}

function childKeys(v: D): string[] {
  if (Array.isArray(v)) return v.map((_, i) => String(i));
  if (v !== null && typeof v === 'object') return Object.keys(v);
  return [];
}

function evalFilter(expr: string, v: D): boolean {
  const m = expr.match(/^@?(?:\.([a-zA-Z_$][\w$]*))?\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) {
    // truthiness: @.field or @field
    const t = expr.replace(/^@\s*\.?/, '').trim();
    if (!t || t.includes('(') || t.includes('&&') || t.includes('||')) return false;
    const val: D =
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, D>)[t]
        : undefined;
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
    return true;
  }
  const key = m[1];
  const op = m[2]!;
  const raw = m[3]!.trim();
  let rhs: D;
  if (/^'(?:[^'\\]|\\.)*'$/.test(raw)) {
    rhs = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
    rhs = Number(raw);
  } else if (raw === 'true' || raw === 'false') {
    rhs = raw === 'true';
  } else if (raw === 'null') {
    rhs = null;
  } else {
    rhs = raw;
  }
  const o = v as Record<string, unknown> | null;
  const lhs: D = key ? (o && typeof o === 'object' && !Array.isArray(o) ? o[key] : undefined) : v;
  switch (op) {
    case '==':
      return lhs === rhs;
    case '!=':
      return lhs !== rhs;
    case '<':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs < rhs;
    case '<=':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs <= rhs;
    case '>':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs > rhs;
    case '>=':
      return typeof lhs === 'number' && typeof rhs === 'number' && lhs >= rhs;
    default:
      return false;
  }
}

function step(c: Ctx, seg: string, total: { n: number }): Ctx[] {
  const out: Ctx[] = [];
  const cur = c.cur;
  const spill = (r: Ctx[]): void => {
    out.push(...r);
    total.n += r.length;
  };
  if (seg === '*') {
    for (const k of childKeys(cur)) {
      const tmp: Ctx[] = [];
      addChild(tmp, c, k);
      spill(tmp);
      if (total.n > MAX_NODES) break;
    }
    return out;
  }
  if (seg === '..*') {
    const queue: Ctx[] = [c];
    while (queue.length) {
      const node = queue.shift()!;
      if (total.n > MAX_NODES) break;
      for (const k of childKeys(node.cur)) {
        const tmp: Ctx[] = [];
        addChild(tmp, node, k);
        if (tmp.length) {
          spill(tmp);
          queue.push(tmp[0]!);
        }
      }
    }
    return out;
  }
  if (seg.startsWith('..')) {
    const key = seg.slice(2);
    const queue: Ctx[] = [c];
    while (queue.length) {
      const node = queue.shift()!;
      if (total.n > MAX_NODES) break;
      const keys = childKeys(node.cur);
      if (key) {
        if (keys.includes(key)) {
          const tmp: Ctx[] = [];
          addChild(tmp, node, key);
          spill(tmp);
        }
        for (const k of keys) {
          const tmp: Ctx[] = [];
          addChild(tmp, node, k);
          if (tmp.length) queue.push(tmp[0]!);
        }
      } else {
        for (const k of keys) {
          const tmp: Ctx[] = [];
          addChild(tmp, node, k);
          if (tmp.length) {
            spill(tmp);
            queue.push(tmp[0]!);
          }
        }
      }
    }
    return out;
  }
  if (seg.startsWith('[') && seg.endsWith(']')) {
    const inner = seg.slice(1, -1).trim();
    if (inner === '*') {
      for (const k of childKeys(cur)) {
        const tmp: Ctx[] = [];
        addChild(tmp, c, k);
        spill(tmp);
        if (total.n > MAX_NODES) break;
      }
      return out;
    }
    if (/^-?\d+$/.test(inner)) {
      if (!Array.isArray(cur)) return out;
      const n = Number(inner);
      const i = n < 0 ? cur.length + n : n;
      if (i >= 0 && i < cur.length) out.push({ cur: cur[i]!, path: c.path + '[' + i + ']' });
      return out;
    }
    if (/^-?\d*:?-?\d*(:-?\d+)?$/.test(inner)) {
      if (!Array.isArray(cur)) return out;
      const parts = inner.split(':');
      const n = cur.length;
      const stepRaw = parts[2] !== undefined ? Number(parts[2]) : 1;
      if (stepRaw === 0) return out;
      const sRaw =
        parts[0] !== undefined && parts[0] !== '' ? Number(parts[0]) : stepRaw > 0 ? 0 : n - 1;
      const eRaw =
        parts[1] !== undefined && parts[1] !== '' ? Number(parts[1]) : stepRaw > 0 ? n : -1;
      const s = sRaw < 0 ? Math.max(n + sRaw, 0) : Math.min(sRaw, n);
      const e = eRaw < 0 ? (stepRaw > 0 ? Math.max(n + eRaw, 0) : eRaw) : Math.min(eRaw, n);
      if (stepRaw > 0) {
        for (let i = s; i < e && i < n; i += stepRaw)
          out.push({ cur: cur[i]!, path: c.path + '[' + i + ']' });
      } else {
        for (let i = s; i > e && i >= 0; i += stepRaw)
          out.push({ cur: cur[i]!, path: c.path + '[' + i + ']' });
      }
      return out;
    }
    const filt = inner.match(/^\?\((.*)\)$/);
    if (filt) {
      for (const k of childKeys(cur)) {
        const tmp: Ctx[] = [];
        addChild(tmp, c, k);
        if (tmp.length && evalFilter(filt[1] ?? '', tmp[0]!.cur)) {
          spill(tmp);
          if (total.n > MAX_NODES) break;
        }
      }
      return out;
    }
    const key = inner.replace(/^["']|["']$/g, '');
    addChild(out, c, key);
    return out;
  }
  // plain key (bracket-style ['key'] resolved above; here dot key)
  addChild(out, c, seg);
  return out;
}

export function evaluate(path: string, data: D): Ctx[] {
  let p = path.trim();
  if (p.startsWith('$')) p = p.slice(1);
  if (!p) return [{ cur: data, path: '$' }];

  const segs: string[] = [];
  let i = 0;
  while (i < p.length) {
    const ch = p[i]!;
    if (ch === '.') {
      if (p[i + 1] === '.') {
        i += 2;
        if (p[i] === '*') {
          segs.push('..*');
          i += 1;
        } else if (p[i] === '[') {
          let j = i;
          let depth = 0;
          for (; j < p.length; j++) {
            if (p[j] === '[') depth++;
            else if (p[j] === ']') {
              depth--;
              if (depth === 0) break;
            }
          }
          segs.push('..' + p.slice(i, j + 1));
          i = j + 1;
        } else {
          let j = i;
          while (j < p.length && /[\w$]/.test(p[j]!)) j++;
          segs.push('..' + p.slice(i, j));
          i = j;
        }
      } else {
        i += 1;
      }
    } else if (ch === '[') {
      let j = i;
      let depth = 0;
      for (; j < p.length; j++) {
        if (p[j] === '[') depth++;
        else if (p[j] === ']') {
          depth--;
          if (depth === 0) break;
        }
      }
      segs.push(p.slice(i, j + 1));
      i = j + 1;
    } else if (ch === '*') {
      segs.push('*');
      i += 1;
    } else if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < p.length && /[\w$]/.test(p[j]!)) j++;
      segs.push(p.slice(i, j));
      i = j;
    } else {
      i += 1;
    }
  }

  let ctxs: Ctx[] = [{ cur: data, path: '$' }];
  const total = { n: 0 };
  for (const seg of segs) {
    const next: Ctx[] = [];
    for (const c of ctxs) {
      next.push(...step(c, seg, total));
      if (total.n > MAX_NODES) break;
    }
    ctxs = next.slice(0, MAX_NODES);
    if (ctxs.length === 0) break;
  }
  return ctxs;
}

function firstNonEmpty(input: string): { expr: string; rest: string } {
  const lines = input.split('\n');
  let idx = 0;
  for (; idx < lines.length; idx++) {
    if (lines[idx]!.trim()) break;
  }
  const expr = lines[idx]?.trim() ?? '';
  const rest = lines
    .slice(idx + 1)
    .join('\n')
    .trim();
  return { expr, rest };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const compact = o.compact === true;
  const showPaths = o.showPaths === true;
  const text = input.text ?? '';
  const { expr, rest } = firstNonEmpty(text);
  if (!expr) throw new ToolError('Enter a JSONPath expression.', 'Example: $.users[*].name');
  if (!rest)
    throw new ToolError(
      'Enter the JSON document after the expression.',
      'Paste JSON on the lines below the expression.',
    );
  let data: D;
  try {
    data = JSON.parse(rest) as D;
  } catch {
    throw new ToolError(
      'Invalid JSON document.',
      'The text after the expression must be valid JSON.',
    );
  }
  const matches = evaluate(expr, data);
  const values = matches.map((m) => m.cur);
  const space = compact ? 0 : 2;
  if (showPaths) {
    const withPaths = values.map((v, i) => ({
      path: matches[i]!.path,
      value: v,
    }));
    return {
      output: JSON.stringify(withPaths, null, space),
      render: 'code',
      stats: { matches: values.length },
      notes: [`Matched ${values.length} node${values.length === 1 ? '' : 's'}.`],
    };
  }
  return {
    output: JSON.stringify(values, null, space),
    render: 'code',
    stats: { matches: values.length },
    notes: [
      `Matched ${values.length} node${values.length === 1 ? '' : 's'}.`,
      ...(values.length === 0 ? ['No nodes matched the expression.'] : []),
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
