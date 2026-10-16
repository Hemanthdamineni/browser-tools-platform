import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './http-range.meta';

type Range = { start: number | null; end: number | null; suffix: number | null; raw: string; issues: string[] };
function parseRange(raw: string, size: number): Range | null {
  const value = raw.trim(); const issues: string[] = [];
  const match = /^(?:bytes=)?(\d*)-(\d*)$/.exec(value);
  if (!match) return null;
  const a = match[1] ?? ''; const b = match[2] ?? '';
  if (!a && !b) return null;
  if (!a) {
    const suffix = Number(b); if (!Number.isSafeInteger(suffix) || suffix <= 0) issues.push('Suffix length must be a positive integer');
    else if (size > 0 && suffix > size) issues.push('Suffix exceeds representation size and resolves to the whole representation');
    return { start: null, end: null, suffix, raw: value, issues };
  }
  const start = Number(a); const end = b ? Number(b) : null;
  if (!Number.isSafeInteger(start) || (end !== null && !Number.isSafeInteger(end))) issues.push('Byte positions must be safe integers');
  if (end !== null && end < start) issues.push('End byte must be greater than or equal to start');
  if (size > 0 && start >= size) issues.push('Range starts beyond the representation and is unsatisfiable');
  return { start, end, suffix: null, raw: value, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode); const header = String(options.header);
  if (!['build', 'parse'].includes(mode)) throw new ToolError('Choose a supported range mode.');
  if (mode === 'build') {
    const start = Number(options.start); const end = Number(options.end); const size = Number(options.size);
    if (![start, end, size].every(Number.isSafeInteger) || start < 0 || end < -1 || size < 0) throw new ToolError('Byte positions and size must be safe non-negative integers; end may be -1 for open ranges.');
    if (header === 'accept-ranges') return { output: 'bytes', render: 'code', language: 'http', filename: 'range-header.txt', stats: { header: 'Accept-Ranges' } };
    if (header === 'range') {
      if (end >= 0 && end < start) throw new ToolError('End byte must be greater than or equal to start.');
      return { output: `bytes=${start}-${end >= 0 ? end : ''}`, render: 'code', language: 'http', filename: 'range-header.txt', stats: { header: 'Range' } };
    }
    if (size <= 0) throw new ToolError('Content-Range requires a positive representation size.');
    if (end < start || end >= size) throw new ToolError('Content-Range end must be within the representation and not before start.');
    return { output: `bytes ${start}-${end}/${size}`, render: 'code', language: 'http', filename: 'range-header.txt', stats: { header: 'Content-Range' } };
  }
  const size = Number(options.size); if (!Number.isSafeInteger(size) || size < 0) throw new ToolError('Representation size must be a non-negative safe integer.');
  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { output: JSON.stringify({ headers: ['Value', 'Start', 'End', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste one range value per line.'] };
  const rows = lines.map((line) => {
    if (line.startsWith('bytes ')) {
      const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(line); if (!match) return [line, '', '', 'Invalid Content-Range'];
      const start = Number(match[1]); const end = Number(match[2]); const total = match[3] === '*' ? 0 : Number(match[3]);
      const issues = end < start ? 'End precedes start' : total > 0 && (start >= total || end >= total) ? 'Range exceeds representation' : '';
      return [line, String(start), String(end), issues || 'Valid Content-Range'];
    }
    const parsed = parseRange(line, size); if (!parsed) return [line, '', '', 'Invalid byte range'];
    const end = parsed.suffix !== null ? (size > 0 ? Math.max(0, size - parsed.suffix) + parsed.suffix - 1 : '') : parsed.end ?? '';
    return [line, parsed.start === null ? 'suffix' : String(parsed.start), String(end), parsed.issues.join('; ') || 'Valid byte range'];
  });
  return { output: JSON.stringify({ headers: ['Value', 'Start', 'End', 'Assessment'], rows }), render: 'table', stats: { values: lines.length, invalid: rows.filter((row) => row[3]?.startsWith('Invalid')).length, issues: rows.filter((row) => row[3] && !row[3].startsWith('Valid')).length }, notes: ['Range end positions are inclusive. No resource is fetched or inspected.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
