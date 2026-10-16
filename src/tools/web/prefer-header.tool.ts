import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './prefer-header.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
type Preference = { name: string; value?: string; raw: string; issues: string[] };
function splitPreferences(text: string): string[] { const values: string[] = []; let current = ''; let quoted = false; for (const char of text) { if (char === '"') quoted = !quoted; if (char === ',' && !quoted) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char; } if (current.trim()) values.push(current.trim()); return values; }
function parse(text: string): Preference[] {
  return splitPreferences(text).map((raw) => {
    const part = raw.trim(); const index = part.indexOf('='); const name = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase(); let value = index < 0 ? undefined : part.slice(index + 1).trim(); const issues: string[] = [];
    if (value?.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
    if (!TOKEN.test(name)) issues.push('Invalid preference token');
    if (value !== undefined && !value) issues.push('Preference value is empty');
    if (name === 'wait' && (!/^\d+$/.test(value ?? '') || Number(value) > 86400)) issues.push('wait must be a whole number from 0 to 86400 seconds');
    return { name, ...(value !== undefined ? { value } : {}), raw: part, issues };
  }).filter((preference) => preference.name);
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Prefer mode.');
  if (mode === 'build') {
    const custom = String(options.custom).trim(); const preference = custom || String(options.preference); const parsed = parse(preference);
    if (!preference || parsed.length !== 1 || parsed[0]!.issues.length) throw new ToolError(parsed[0]?.issues[0] ?? 'Enter a valid preference.');
    return { output: preference, render: 'code', language: 'http', filename: 'prefer.txt', stats: { preferences: 1, type: parsed[0]!.name } };
  }
  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean); if (!lines.length) return { output: JSON.stringify({ headers: ['Preference', 'Name', 'Value', 'Issues'], rows: [] }), render: 'table', notes: ['Paste comma-separated Prefer directives.'] };
  const parsed = lines.flatMap(parse); const names = parsed.map((preference) => preference.name); const duplicate = new Set(names).size !== names.length; if (duplicate) parsed.forEach((preference) => { if (names.filter((name) => name === preference.name).length > 1) preference.issues.push('Duplicate preference name'); });
  const rows = parsed.map((preference) => [preference.raw, preference.name, preference.value ?? '', preference.issues.join('; ')]);
  return { output: JSON.stringify({ headers: ['Preference', 'Name', 'Value', 'Issues'], rows }), render: 'table', stats: { preferences: parsed.length, invalid: parsed.filter((preference) => preference.issues.length).length, duplicates: duplicate ? 'yes' : 'no' }, notes: ['Prefer is a client hint; servers may ignore it or report applied preferences separately.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
