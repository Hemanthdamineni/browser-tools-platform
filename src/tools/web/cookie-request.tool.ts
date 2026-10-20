import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cookie-request.meta';

function splitPairs(text: string): string[] {
  // Split on semicolons while honoring double-quoted strings that may contain semicolons.
  const pairs: string[] = [];
  let current = '';
  let inQuote = false;
  for (const char of text) {
    if (char === '"') inQuote = !inQuote;
    if (char === ';' && !inQuote) {
      pairs.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) pairs.push(current.trim());
  return pairs;
}
function build(text: string): TextRunResult {
  const raw = text.trim();
  const pairs = splitPairs(raw).map((pair) => pair.split('=').map((part) => part.trim()));
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const [name] of pairs) {
    if (!name) issues.push('Empty cookie name (a pair without = was provided)');
    else if (seen.has(name.toLowerCase())) issues.push(`Duplicate cookie name: ${name}`);
    else seen.add(name.toLowerCase());
  }
  if (!pairs.length) throw new ToolError('Enter at least one name=value pair.');
  const output = pairs.map(([name, value]) => `${name || ''}=${value ?? ''}`).join('; ');
  return {
    output,
    render: 'code',
    language: 'http',
    filename: 'cookie-request.txt',
    stats: { pairs: pairs.length, 'duplicates found': issues.length },
    notes: issues.length
      ? issues
      : ['Built a Cookie request header with ' + pairs.length + ' pair(s).'],
  };
}
function inspect(input: TextRunInput): TextRunResult {
  const value = input.text.trim();
  if (!value)
    return {
      output: JSON.stringify({ headers: ['Name', 'Value', 'Status'], rows: [] }),
      render: 'table',
      notes: ['Paste a Cookie request header to parse, or use Build mode.'],
    };
  const body = value.replace(/^Cookie\s*:\s*/i, '');
  const pairs = splitPairs(body);
  if (!pairs.length)
    return {
      output: JSON.stringify({ headers: ['Name', 'Value', 'Status'], rows: [] }),
      render: 'table',
      notes: ['No cookie pairs found in the provided text.'],
    };
  const seen = new Map<string, number>();
  const rows: string[][] = [];
  let duplicates = 0;
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const name = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
    const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
    const decoded = rawValue.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    const key = name.toLowerCase();
    const prev = seen.get(key);
    seen.set(key, (prev ?? 0) + 1);
    if (prev) duplicates++;
    rows.push([name, decoded, !name ? 'Invalid — empty name' : prev ? 'Duplicate' : 'Valid']);
  }
  return {
    output: JSON.stringify({ headers: ['Name', 'Value', 'Status'], rows }),
    render: 'table',
    stats: { pairs: rows.length, duplicates, encoded: body.includes('%') ? 'yes' : 'no' },
    notes: duplicates
      ? [`${duplicates} duplicate cookie name(s) — servers typically keep only the last value.`]
      : [
          'Parsed Cookie header; values shown percent-decoded. Pairs with an empty name are invalid.',
        ],
  };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'build') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') return build(String(options.pairs));
  return inspect(input);
}
const tool: TextToolModule = { meta, run };
export default tool;
