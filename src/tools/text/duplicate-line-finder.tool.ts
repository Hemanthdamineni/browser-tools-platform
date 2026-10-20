import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './duplicate-line-finder.meta';

const MAX_LEN = 1_000_000;

interface Group {
  display: string;
  count: number;
  firstLine: number;
}

function collect(lines: string[], ignoreCase: boolean, trim: boolean): Map<string, Group> {
  const map = new Map<string, Group>();
  for (let i = 0; i < lines.length; i++) {
    const original = lines[i]!;
    let normalized = original;
    if (trim) normalized = normalized.trim();
    if (ignoreCase) normalized = normalized.toLowerCase();
    let g = map.get(normalized);
    if (!g) {
      g = { display: original, count: 0, firstLine: i + 1 };
      map.set(normalized, g);
    }
    g.count += 1;
  }
  return map;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const ignoreCase = o.ignoreCase === true;
  const trim = o.trim === true;
  const includeUnique = o.includeUnique === true;
  const sortBy = String(o.sortBy ?? 'position');
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste a list of lines to scan for duplicates.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  const lines = source.split(/\r?\n/);
  const map = collect(lines, ignoreCase, trim);
  const groups = [...map.values()];
  const dupGroups = groups.filter((g) => g.count > 1);
  const shown = includeUnique ? groups : dupGroups;

  if (sortBy === 'frequency') {
    shown.sort((a, b) => b.count - a.count || a.firstLine - b.firstLine);
  } else {
    shown.sort((a, b) => a.firstLine - b.firstLine);
  }

  const rows: string[][] = [];
  for (const g of shown) {
    const display = g.display.length > 80 ? g.display.slice(0, 79) + '…' : g.display;
    rows.push([display, String(g.count), String(g.firstLine)]);
  }

  const duplicateLines = shown.length;
  const extraCount = dupGroups.reduce((n, g) => n + (g.count - 1), 0);
  const headers = ['Line', 'Occurrences', 'First at line'];
  const outputRows = rows.length ? rows : [['—', 'No duplicate lines found.', '—']];

  return {
    output: JSON.stringify({ headers, rows: outputRows }),
    render: 'table',
    stats: { lines: lines.length, duplicates: duplicateLines, extra: extraCount },
    notes: [
      extraCount ? 'Found ' + extraCount + ' duplicated line(s) across ' + dupGroups.length + ' distinct line(s).' : 'No duplicates — every line is unique.',
      ignoreCase && trim ? 'Matched on lowercase, trimmed text.' : ignoreCase ? 'Matched on lowercase text (case-insensitive).' : trim ? 'Matched on trimmed text.' : 'Matched byte-for-byte.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
