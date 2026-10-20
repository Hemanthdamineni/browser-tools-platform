import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-sql.meta';

const MAX_LEN = 2_000_000;

function quoteIdent(name: string, mysql: boolean): string {
  if (mysql) return '`' + name.replace(/`/g, '``') + '`';
  return '"' + name.replace(/"/g, '""') + '"';
}

function quoteString(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function literal(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ToolError('Non-finite number in input.', 'Use null instead of NaN/Infinity.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return quoteString(JSON.stringify(value) ?? 'null');
}

function columnType(values: unknown[]): string {
  const kinds = new Set<string>();
  for (const v of values) {
    if (v === null) continue;
    if (typeof v === 'number') kinds.add(Number.isInteger(v) ? 'integer' : 'real');
    else if (typeof v === 'boolean') kinds.add('integer');
    else kinds.add('text');
  }
  if (kinds.size === 1) {
    if (kinds.has('integer')) return 'INTEGER';
    if (kinds.has('real')) return 'REAL';
  }
  return 'TEXT';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const table = String(o.table ?? '').trim();
  const mysql = String(o.dialect ?? 'standard') === 'mysql';
  const includeCreate = o.includeCreate === true;
  const transaction = o.transaction !== false;
  const multiRow = o.multiRow === true;

  if (!table) throw new ToolError('Provide a table name.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new ToolError('Table name must be a valid identifier.', 'Letters, digits and underscores; no spaces.');
  }

  const raw = String(input.text ?? '').trim();
  if (!raw) throw new ToolError('Paste a JSON array of objects.');
  if (raw.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ToolError('Invalid JSON: ' + (e as Error).message);
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (rows.length === 0) throw new ToolError('The JSON array is empty.');
  const objects: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r === null || typeof r !== 'object' || Array.isArray(r)) {
      throw new ToolError('Every item must be a JSON object.', 'Item ' + (i + 1) + ' is not an object.');
    }
    objects.push(r as Record<string, unknown>);
  }

  // Union of keys, first-seen order.
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const obj of objects) {
    for (const k of Object.keys(obj)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }

  const statements: string[] = [];
  if (includeCreate) {
    const defs = columns.map((c) => {
      const vals = objects.map((ob) => (c in ob ? ob[c] : null));
      return '  ' + quoteIdent(c, mysql) + ' ' + columnType(vals);
    });
    statements.push('CREATE TABLE ' + quoteIdent(table, mysql) + ' (\n' + defs.join(',\n') + '\n);');
  }

  const colList = columns.map((c) => quoteIdent(c, mysql)).join(', ');
  if (multiRow) {
    const valueRows = objects.map((ob) => {
      const vals = columns.map((c) => literal(c in ob ? ob[c] : null));
      return '  (' + vals.join(', ') + ')';
    });
    statements.push('INSERT INTO ' + quoteIdent(table, mysql) + ' (' + colList + ') VALUES\n' + valueRows.join(',\n') + ';');
  } else {
    for (const ob of objects) {
      const vals = columns.map((c) => literal(c in ob ? ob[c] : null));
      statements.push('INSERT INTO ' + quoteIdent(table, mysql) + ' (' + colList + ') VALUES (' + vals.join(', ') + ');');
    }
  }

  let body = statements.join('\n');
  if (transaction) {
    body = 'BEGIN;\n' + body + '\nCOMMIT;';
  }

  return {
    output: body + '\n',
    render: 'text',
    language: 'sql',
    stats: { rows: objects.length, columns: columns.length, statements: statements.length },
    notes: [
      objects.length + ' row(s), ' + columns.length + ' column(s): ' + columns.join(', '),
      'Strings escape quotes by doubling; nested objects/arrays become JSON strings.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
