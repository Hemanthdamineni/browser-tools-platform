import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './retry-after.meta';

const MAX_SECONDS = 2_147_483_647;
function parseValue(raw: string): { form: string; value: string; date?: Date; issues: string[] } | null {
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return { form: 'delta-seconds', value, issues: seconds > MAX_SECONDS ? ['Delay exceeds the common 32-bit maximum'] : [] };
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && /\bGMT$/i.test(value)) return { form: 'HTTP-date', value, date, issues: [] };
  return null;
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'parse') throw new ToolError('Choose a supported Retry-After mode.');
  if (mode === 'build') {
    const form = String(options.form); const seconds = Number(options.seconds);
    if (form === 'seconds') {
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS) throw new ToolError(`Delay must be a whole number from 0 to ${MAX_SECONDS.toLocaleString()}.`);
      return { output: String(seconds), render: 'code', language: 'http', filename: 'retry-after.txt', stats: { form: 'delta-seconds', seconds } };
    }
    if (form !== 'date') throw new ToolError('Choose delta-seconds or HTTP-date output.');
    const rawDate = String(options.date).trim(); const date = new Date(rawDate);
    if (!rawDate || Number.isNaN(date.getTime()) || !/\bGMT$/i.test(rawDate)) throw new ToolError('Enter a valid HTTP-date ending in GMT, such as Wed, 21 Oct 2015 07:28:00 GMT.');
    return { output: date.toUTCString(), render: 'code', language: 'http', filename: 'retry-after.txt', stats: { form: 'HTTP-date' } };
  }
  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { output: JSON.stringify({ headers: ['Value', 'Form', 'Parsed meaning', 'Issues'], rows: [] }), render: 'table', notes: ['Paste one Retry-After value per line.'] };
  const rows = lines.map((line) => {
    const parsed = parseValue(line);
    if (!parsed) return [line, 'Invalid', '', 'Expected non-negative seconds or an HTTP-date ending in GMT'];
    const meaning = parsed.date ? parsed.date.toISOString() : `${Number(parsed.value).toLocaleString()} second(s)`;
    return [line, parsed.form, meaning, parsed.issues.join('; ')];
  });
  return { output: JSON.stringify({ headers: ['Value', 'Form', 'Parsed meaning', 'Issues'], rows }), render: 'table', stats: { values: lines.length, invalid: rows.filter((row) => row[1] === 'Invalid').length, warnings: rows.filter((row) => Boolean(row[3])).length }, notes: ['Actual retry timing can vary with clock skew, latency, and server policy.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
