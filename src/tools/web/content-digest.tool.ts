import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-digest.meta';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
type Entry = { algorithm: string; value: string; issues: string[] };
function parseEntry(raw: string): Entry | null {
  const match = /^([A-Za-z][A-Za-z0-9-]*)=:(.*):$/.exec(raw.trim()); if (!match) return null;
  const algorithm = match[1]!.toLowerCase(); const value = match[2]!; const issues: string[] = [];
  if (!['sha-256', 'sha-512'].includes(algorithm)) issues.push('Unsupported algorithm for this utility');
  if (!value || !BASE64.test(value) || value.length % 4 !== 0) issues.push('Digest must be padded base64');
  if (algorithm === 'sha-256' && value.length !== 44) issues.push('SHA-256 base64 digests are normally 44 characters');
  if (algorithm === 'sha-512' && value.length !== 88) issues.push('SHA-512 base64 digests are normally 88 characters');
  return { algorithm, value, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Content-Digest mode.');
  if (mode === 'build') {
    const algorithm = String(options.algorithm); const digest = String(options.digest).trim(); const entry = parseEntry(`${algorithm}=:${digest}:`);
    if (!entry || entry.issues.length) throw new ToolError(entry?.issues[0] ?? 'Enter a valid base64 digest.');
    return { output: `${algorithm}=:${digest}:`, render: 'code', language: 'http', filename: 'content-digest.txt', stats: { algorithm } };
  }
  const values = input.text.split(/\r\n|\r|\n/).flatMap((line) => line.split(',').map((value) => value.trim()).filter(Boolean));
  if (!values.length) return { output: JSON.stringify({ headers: ['Algorithm', 'Digest', 'Status', 'Issues'], rows: [] }), render: 'table', notes: ['Paste one or more structured Content-Digest entries.'] };
  const parsed = values.map(parseEntry); const seen = new Set<string>(); parsed.forEach((entry) => { if (entry) { if (seen.has(entry.algorithm)) entry.issues.push('Duplicate algorithm entry'); seen.add(entry.algorithm); } });
  const rows = parsed.map((entry, index) => entry ? [entry.algorithm, entry.value, entry.issues.length ? 'Review' : 'Valid', entry.issues.join('; ')] : [values[index]!, '', 'Invalid', 'Expected algorithm=:base64: syntax']);
  return { output: JSON.stringify({ headers: ['Algorithm', 'Digest', 'Status', 'Issues'], rows }), render: 'table', stats: { entries: values.length, invalid: parsed.filter((entry) => !entry).length, review: parsed.filter((entry) => entry?.issues.length).length }, notes: ['A syntactically valid digest is not proof of payload integrity without a trusted expected value and exact representation bytes.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
