import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './x-content-type-options.meta';

function inspectValue(text: string): { token: string; issues: string[] } {
  const token = text.trim().toLowerCase();
  if (!token) return { token, issues: ['No X-Content-Type-Options value provided'] };
  if (token === 'nosniff') return { token, issues: [] };
  return {
    token,
    issues: [
      token === 'none'
        ? 'none is not a defined value; the meaningful directive is nosniff'
        : `Unrecognized value: ${token}`,
    ],
  };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  const token = inspectValue(mode === 'build' ? String(options.value) : input.text);
  if (mode === 'build') {
    if (token.issues.length) throw new ToolError(token.issues[0]!);
    return {
      output: 'X-Content-Type-Options: nosniff',
      render: 'code',
      language: 'http',
      filename: 'x-content-type-options.txt',
      stats: { value: 'nosniff' },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Value', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste an X-Content-Type-Options value to analyze.'],
    };
  const status = token.issues.length ? 'Invalid' : 'Valid';
  return {
    output: JSON.stringify({
      headers: ['Value', 'Status', 'Assessment'],
      rows: [
        [
          token.token || input.text.trim(),
          status,
          token.issues[0] ?? 'nosniff — prevents MIME sniffing',
        ],
      ],
    }),
    render: 'table',
    stats: { valid: token.issues.length ? 'no' : 'yes' },
    notes: token.issues.length
      ? token.issues
      : ['nosniff is recommended; it makes the declared Content-Type authoritative.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
