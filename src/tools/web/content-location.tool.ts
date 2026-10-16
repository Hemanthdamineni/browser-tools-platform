import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-location.meta';

function inspect(value: string): { issues: string[]; kind: string } | null {
  const reference = value.trim(); if (!reference || /[\r\n\t]/.test(reference) || /\s/.test(reference)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) { try { const url = new URL(reference); return { kind: 'absolute URI', issues: url.hash ? ['Fragment identifiers are not sent in HTTP requests and may be misleading here'] : [] }; } catch { return null; } }
  if (reference.startsWith('//')) return { kind: 'network-path reference', issues: [] };
  if (reference.startsWith('/') || reference.startsWith('./') || reference.startsWith('../') || /^[^:?#]+(?:[?#].*)?$/.test(reference)) return { kind: 'relative URI reference', issues: reference.includes('#') ? ['Fragment identifiers may not identify an HTTP representation'] : [] };
  return null;
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Content-Location mode.');
  const values = (mode === 'build' ? [String(options.location).trim()] : input.text.split(/\r\n|\r|\n/).map((value) => value.trim()).filter(Boolean)); if (mode === 'build' && !values[0]) throw new ToolError('Enter a valid absolute or relative URI reference without whitespace or control characters.'); if (!values.length) return { output: JSON.stringify({ headers: ['Reference', 'Kind', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste one Content-Location reference.'] };
  const results = values.map(inspect); if (mode === 'build') { if (!results[0]) throw new ToolError('Enter a valid absolute or relative URI reference without whitespace or control characters.'); return { output: values[0]!, render: 'code', language: 'http', filename: 'content-location.txt', stats: { kind: results[0].kind } }; }
  const rows = values.map((value, index) => [value, results[index]?.kind ?? 'Invalid', results[index]?.issues.join('; ') || (results[index] ? 'Valid reference' : 'Invalid URI reference')]); return { output: JSON.stringify({ headers: ['Reference', 'Kind', 'Assessment'], rows }), render: 'table', stats: { references: values.length, invalid: results.filter((result) => !result).length, warnings: results.filter((result) => result?.issues.length).length }, notes: ['Content-Location is metadata, not a redirect, and references are not fetched.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
