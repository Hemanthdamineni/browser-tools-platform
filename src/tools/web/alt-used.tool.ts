import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './alt-used.meta';

function inspect(value: string): { host: string; port: string; issues: string[] } {
  const raw = value.trim();
  const issues: string[] = [];
  let host = raw;
  let port = '';
  if (/^Alt-Used\s*:\s*/i.test(raw)) {
    const stripped = raw.replace(/^[^:]+:\s*/, '');
    host = stripped;
  }
  const match = /^([^:]+)(?::([0-9]+))?$/.exec(host);
  const name = match?.[1] ?? host;
  if (!name || name.includes(' ')) issues.push('Empty or invalid host portion');
  if (name === '*' ) issues.push('Wildcard authority is not permitted in Alt-Used — it must name the specific alternative used');
  if (name.includes('://')) issues.push('Alt-Used is a plain host, not a URL; omit the scheme');
  if (match?.[2]) { const p = Number(match[2]); if (p < 1 || p > 65535) issues.push(`Port ${p} is out of range (1–65535)`); port = match[2]; }
  return { host: name, port, issues };
}
function run(input: TextRunInput): TextRunResult { const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.'); const source = mode === 'build' ? String(options.value) : input.text; const inspected = inspect(source); if (mode === 'build') { if (inspected.issues.length) throw new ToolError(inspected.issues[0]!); return { output: inspected.port ? `Alt-Used: ${inspected.host}:${inspected.port}` : `Alt-Used: ${inspected.host}`, render: 'code', language: 'http', filename: 'alt-used.txt', stats: { host: inspected.host, port: inspected.port || '(default)' } }; } if (!input.text.trim()) return { output: JSON.stringify({ headers: ['Host', 'Port', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste an Alt-Used value (host, or host:port) to analyze.'] }; const status = inspected.issues.length ? 'Invalid' : 'Valid'; return { output: JSON.stringify({ headers: ['Host', 'Port', 'Status', 'Assessment'], rows: [[inspected.host, inspected.port || '(default)', status, inspected.issues.join('; ') || `Tells the origin which alternative was used for ${input.text.trim()} — mirrors the Alt-Svc received earlier`]] }), render: 'table', stats: { host: inspected.host, port: inspected.port || 'default', valid: inspected.issues.length ? 'no' : 'yes' }, notes: inspected.issues.length ? inspected.issues : ['Client confirms the alternative service it used; the server may use this for telemetry and connection pooling.'] }; }
const tool: TextToolModule = { meta, run };
export default tool;