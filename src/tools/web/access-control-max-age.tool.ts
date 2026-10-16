import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './access-control-max-age.meta';

const SECONDS_RE = /^[0-9]+$/;
function inspect(value: string): { seconds: number | null; issues: string[]; notes: string[] } {
  const trimmed = value.trim();
  const issues: string[] = [];
  const notes: string[] = [];
  let seconds: number | null = null;
  if (!trimmed) {
    issues.push('No Access-Control-Max-Age value provided');
  } else if (!SECONDS_RE.test(trimmed)) {
    issues.push('Access-Control-Max-Age must be a non-negative integer of seconds');
  } else {
    seconds = Number(trimmed);
    if (seconds > 604800) issues.push(`Value ${seconds}s is above one week; browsers will likely ignore it and cap internally`);
    else if (seconds > 3600) notes.push('Large value; many browsers implement a much shorter internal cap');
    else if (seconds === 30) notes.push('30s is a common conservative choice for frequently-changing CORS config');
  }
  return { seconds, issues, notes };
}
function run(input: TextRunInput): TextRunResult { const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.'); const source = mode === 'build' ? String(options.seconds) : input.text; const inspected = inspect(source); if (mode === 'build') { if (inspected.issues.length) throw new ToolError(inspected.issues[0]!); return { output: `Access-Control-Max-Age: ${inspected.seconds}`, render: 'code', language: 'http', filename: 'access-control-max-age.txt', stats: { seconds: inspected.seconds! } }; } if (!input.text.trim()) return { output: JSON.stringify({ headers: ['Seconds', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste an Access-Control-Max-Age value (seconds) to analyze.'] }; const values = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean); const rows = values.map((value) => { const checked = inspect(value); return [value, checked.issues.length ? 'Invalid' : 'Valid', checked.issues.join('; ') || (checked.notes[0] ?? 'Number of seconds to cache the preflight')]; }); return { output: JSON.stringify({ headers: ['Seconds', 'Status', 'Assessment'], rows }), render: 'table', stats: { values: rows.length, invalid: rows.filter((row) => row[1] === 'Invalid').length }, notes: ['Browsers cap the cached preflight differently; it is best practice to keep this modest.'] }; }
const tool: TextToolModule = { meta, run };
export default tool;
