import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-sql.meta';

interface CsvRow {
  cells: string[];
  quoted: boolean[];
  line: number;
}

const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** RFC 4180 parser: comma separated, double-quote quoting, doubled quotes inside. */
function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let quoted: boolean[] = [];
  let cur = '';
  let wasQuoted = false;
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endCell = () => {
    cells.push(cur);
    quoted.push(wasQuoted);
    cur = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    const blank = cells.length === 1 && cells[0] === '' && quoted[0] === false;
    if (!blank) rows.push({ cells, quoted, line: rowLine });
    cells = [];
    quoted = [];
    rowLine = line;
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
    if (ch === '"') {
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\r') {
      // ignore; handled by \n
    } else if (ch === '\n') {
      endRow();
      line++;
      rowLine = line;
    } else {
      cur += ch;
    }
  }
  if (inQuotes) {
    throw new ToolError(
      `Unterminated quoted field starting near line ${rowLine}.`,
      'Every opening double quote needs a closing quote — doubled quotes ("") mean a literal quote.',
    );
  }
  if (cur !== '' || cells.length > 0) endRow();
  return rows;
}

interface LiteralOpts {
  quote: "'" | '"';
  nullText: string;
  emptyAsNull: boolean;
  mysqlEscapes: boolean;
}

function sqlLiteral(cell: string, isQuoted: boolean, o: LiteralOpts): string {
  if (!isQuoted) {
    if (o.nullText !== '' && cell === o.nullText) return 'NULL';
    if (cell === '' && o.emptyAsNull) return 'NULL';
    const looksNumeric = NUMERIC.test(cell) && !/^[+-]?0\d/.test(cell);
    if (looksNumeric) return cell;
  }
  let body = cell;
  if (o.mysqlEscapes) {
    body = body.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }
  body = o.quote === "'" ? body.replace(/'/g, "''") : body.replace(/"/g, '""');
  return `${o.quote}${body}${o.quote}`;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);

  const table = String(o.table ?? '').trim();
  if (!IDENT.test(table)) {
    throw new ToolError(
      `"${table}" is not a valid SQL table name.`,
      'Use letters, digits and underscores, starting with a letter or underscore.',
    );
  }

  const quote: "'" | '"' = String(o.quoteStyle) === 'double' ? '"' : "'";
  const nullText = String(o.nullText ?? 'NULL');
  const emptyAsNull = o.emptyAsNull !== false;
  const mysqlEscapes = o.mysqlEscapes === true;
  const rawBatch = Number(o.batch);
  const batch = Number.isFinite(rawBatch) ? Math.max(1, Math.min(1000, Math.trunc(rawBatch))) : 100;

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Paste a CSV table to convert.',
      'First row is treated as the column header by default; every later row becomes an INSERT tuple.',
    );
  }

  const rows = parseCsv(text);
  if (rows.length === 0)
    throw new ToolError(
      'No CSV rows were found in the input.',
      'Check that the data is non-empty.',
    );

  const hasHeader = o.header !== false;
  let columns: string[];
  let dataRows: CsvRow[];

  if (hasHeader) {
    columns = rows[0]!.cells;
    dataRows = rows.slice(1);
    if (dataRows.length === 0) {
      throw new ToolError(
        'The CSV has a header but no data rows.',
        'Add at least one row of data after the header.',
      );
    }
  } else {
    columns = rows[0]!.cells.map((_, i) => `col${i + 1}`);
    dataRows = rows;
  }

  if (columns.length === 0)
    throw new ToolError('The CSV has no columns.', 'Add at least one column.');

  const badNames = columns.filter((c) => !IDENT.test(c.trim()));
  if (badNames.length > 0) {
    throw new ToolError(
      `Column names are not valid SQL identifiers: ${badNames.join(', ')}.`,
      'Headers must be letters, digits and underscores starting with a letter or underscore.',
    );
  }
  const seen = new Set<string>();
  const dupes = columns.filter((c) => (seen.has(c) ? true : !seen.add(c)));
  if (dupes.length > 0) {
    throw new ToolError(
      `Duplicate column names: ${[...new Set(dupes)].join(', ')}.`,
      'Rename the duplicate headers so every column maps to a unique SQL column.',
    );
  }

  columns = columns.map((c) => c.trim());
  for (const row of dataRows) {
    if (row.cells.length !== columns.length) {
      throw new ToolError(
        `Row ${row.line} has ${row.cells.length} cells but the table has ${columns.length} columns.`,
        'Every CSV row must have the same number of fields as the header.',
      );
    }
  }

  const opts: LiteralOpts = { quote, nullText, emptyAsNull, mysqlEscapes };
  const colList = columns.join(', ');

  const statements: string[] = [];
  for (let start = 0; start < dataRows.length; start += batch) {
    const slice = dataRows.slice(start, start + batch);
    const tupleLines = slice.map(
      (row) => `(${row.cells.map((cell, i) => sqlLiteral(cell, row.quoted[i]!, opts)).join(', ')})`,
    );
    statements.push(`INSERT INTO ${table} (${colList}) VALUES\n${tupleLines.join(',\n')};`);
  }
  const output = statements.join('\n') + '\n';

  const notes: string[] = [];
  notes.push(
    `Generated ${dataRows.length} INSERT row${dataRows.length === 1 ? '' : 's'} across ${statements.length} statement${statements.length === 1 ? '' : 's'} for table "${table}".`,
  );
  notes.push(`String literals use ${quote === "'" ? 'single' : 'double'} quotes.`);
  if (mysqlEscapes) notes.push('MySQL backslash escaping is ON (\\ and new lines are escaped).');
  if (nullText !== '')
    notes.push(`Cells equal to "${nullText}" (and empty cells, if enabled) become NULL.`);

  return {
    output,
    render: 'code',
    stats: {
      rows: dataRows.length,
      columns: columns.length,
      statements: statements.length,
      bytes: new TextEncoder().encode(output).length,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
