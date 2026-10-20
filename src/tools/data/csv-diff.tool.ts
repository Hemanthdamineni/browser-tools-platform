import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-diff.meta';

interface CsvRow {
  cells: string[];
  quoted: boolean[];
  line: number;
}

// RFC 4180 parser: doubled "" escapes, newlines inside quotes, blank rows skipped.
function parseCsv(input: string, delim: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let quoted: boolean[] = [];
  let cur = '';
  let wasQuoted = false;
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  const endCell = (): void => {
    cells.push(cur);
    quoted.push(wasQuoted);
    cur = '';
    wasQuoted = false;
  };
  const endRow = (): void => {
    endCell();
    const blank = cells.length === 1 && cells[0] === '' && quoted[0] === false;
    if (!blank) rows.push({ cells, quoted, line: startLine });
    cells = [];
    quoted = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"' && cur === '') {
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === delim) {
      endCell();
    } else if (ch === '\n') {
      endRow();
      line++;
      startLine = line;
    } else if (ch === '\r') {
      // ignore
    } else {
      cur += ch;
    }
  }
  endRow();
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.split('\n').slice(0, 5).join('\n');
  const cands = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const c of cands) {
    const n = sample.split(c).length - 1;
    if (n > bestCount) {
      bestCount = n;
      best = c;
    }
  }
  return best;
}

const MAX_ROWS = 20_000;

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const a = (input.text ?? '').trim();
  const b = String(o.second ?? '').trim();
  const keyName = String(o.keyColumn ?? '').trim();
  const delimOpt = String(o.delimiter ?? 'auto');

  if (!a) throw new ToolError('Paste the first CSV (A).', 'The main text box holds file A.');
  if (!b) throw new ToolError('Paste the second CSV (B).', 'Use the "Second CSV (B)" field.');
  if (!keyName) throw new ToolError('Choose a key column.', 'Example: id');

  const delimA = delimOpt === 'auto' ? detectDelimiter(a) : delimOpt;
  const delimB = delimOpt === 'auto' ? detectDelimiter(b) : delimOpt;
  const rowsA = parseCsv(a, delimA);
  const rowsB = parseCsv(b, delimB);
  if (rowsA.length === 0 || rowsB.length === 0) {
    throw new ToolError('Both CSVs need at least a header row.', 'Provide at least one header and one data row.');
  }

  const headerA = rowsA[0]!.cells;
  const headerB = rowsB[0]!.cells;
  const idxA = headerA.indexOf(keyName);
  const idxB = headerB.indexOf(keyName);
  if (idxA === -1) throw new ToolError(`Key column "${keyName}" is missing from CSV A.`, `Columns: ${headerA.join(', ')}`);
  if (idxB === -1) throw new ToolError(`Key column "${keyName}" is missing from CSV B.`, `Columns: ${headerB.join(', ')}`);

  const issues: string[] = [];
  const onlyA = headerA.filter((h) => !headerB.includes(h));
  const onlyB = headerB.filter((h) => !headerA.includes(h));
  if (onlyA.length) issues.push(`Columns only in A: ${onlyA.join(', ')}`);
  if (onlyB.length) issues.push(`Columns only in B: ${onlyB.join(', ')}`);
  const shared = headerA.filter((h) => headerB.includes(h) && h !== keyName);

  const mapA = new Map<string, string[]>();
  const mapB = new Map<string, string[]>();
  const dups = new Set<string>();
  const load = (rows: CsvRow[], idx: number, target: Map<string, string[]>): void => {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!;
      const key = r.cells[idx] ?? '';
      if (target.has(key)) dups.add(key);
      target.set(key, r.cells);
    }
  };
  load(rowsA, idxA, mapA);
  load(rowsB, idxB, mapB);
  if (dups.size) issues.push(`Duplicate keys (${dups.size}): ${[...dups].slice(0, 10).join(', ')}`);

  const table: string[][] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const [key, ra] of mapA) {
    const rb = mapB.get(key);
    if (!rb) {
      removed++;
      table.push(['removed', key, '', ra.join(' | '), '']);
      continue;
    }
    let rowChanged = false;
    for (const col of shared) {
      const ia = headerA.indexOf(col);
      const ib = headerB.indexOf(col);
      const va = ra[ia] ?? '';
      const vb = rb[ib] ?? '';
      if (va !== vb) {
        rowChanged = true;
        changed++;
        table.push(['changed', key, col, va, vb]);
      }
    }
    if (!rowChanged) unchanged++;
  }
  for (const [key, rb] of mapB) {
    if (!mapA.has(key)) {
      added++;
      table.push(['added', key, '', '', rb.join(' | ')]);
    }
  }

  const truncated = table.length > MAX_ROWS;
  const rows = table.slice(0, MAX_ROWS);
  const notes: string[] = [
    `${added} added, ${removed} removed, ${changed} changed cell${changed === 1 ? '' : 's'}, ${unchanged} unchanged row${unchanged === 1 ? '' : 's'}.`,
  ];
  if (truncated) notes.push(`Output truncated to ${MAX_ROWS} entries.`);
  for (const issue of issues) notes.push(issue);

  return {
    output: JSON.stringify({ headers: ['Status', 'Key', 'Column', 'A', 'B'], rows }),
    render: 'table',
    stats: { added, removed, changed, unchanged, rowsA: mapA.size, rowsB: mapB.size },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
