import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-json.meta';

const DELIMS: Record<string, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function sniff(text: string): string {
  // Scan up to the first 10 records, not just the first line: a header row can
  // legitimately contain fewer delimiters than the data rows below it (quoted
  // titles, prose), and scoring only line 1 then picks the wrong delimiter.
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    lines.push(raw);
    if (lines.length >= 10) break;
  }
  let best = ',';
  let bestScore = -1;
  for (const ch of [',', ';', '\t', '|']) {
    let score = 0;
    for (const line of lines) {
      const count = line.split(ch).length - 1;
      score += count;
    }
    // Prefer a delimiter that appears on every scanned line; total occurrences
    // break ties so a dense comma table still wins over a sparse one.
    const onEveryLine = lines.every((line) => line.split(ch).length - 1 > 0);
    const final = onEveryLine ? score + lines.length : score;
    if (final > bestScore) {
      bestScore = final;
      best = ch;
    }
  }
  return best;
}

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  if (inQuotes) {
    throw new ToolError(
      'Unterminated quoted field in CSV.',
      'A double quote was opened but never closed.',
    );
  }

  row.push(field);
  rows.push(row);

  // Drop a single trailing empty row produced by a final newline.
  if (rows.length > 1) {
    const last = rows[rows.length - 1]!;
    if (last.length === 1 && last[0] === '') rows.pop();
  }
  return rows;
}

function infer(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num) && String(num) === raw) return num;
  }
  return raw;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const delimName = String(o.delimiter);
  const delim = delimName === 'auto' ? sniff(input.text) : (DELIMS[delimName] ?? ',');

  const rows = parseCsv(input.text, delim);
  if (rows.length === 0) return { output: '' };

  const trim = Boolean(o.trim);
  const inferTypes = Boolean(o.inferTypes);
  const useHeader = Boolean(o.header);

  const norm = (v: string): unknown => {
    const s = trim ? v.trim() : v;
    return inferTypes ? infer(s) : s;
  };

  let keys: string[];
  let dataRows: string[][];
  if (useHeader) {
    const headerRow = rows[0]!;
    keys = headerRow.map((h, idx) => {
      const k = trim ? h.trim() : h;
      return k === '' ? `col${idx + 1}` : k;
    });
    dataRows = rows.slice(1);
  } else {
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    keys = Array.from({ length: width }, (_, idx) => `col${idx + 1}`);
    dataRows = rows;
  }

  const out = dataRows.map((r) => {
    const obj: Record<string, unknown> = {};
    for (let k = 0; k < keys.length; k++) {
      obj[keys[k]!] = norm(r[k] ?? '');
    }
    return obj;
  });

  return {
    output: JSON.stringify(out, null, 2),
    render: 'code',
    language: 'json',
    filename: 'data.json',
    stats: { rows: out.length, columns: keys.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
