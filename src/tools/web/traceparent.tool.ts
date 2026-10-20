import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './traceparent.meta';

const HEX = /^[0-9a-f]+$/i;
function inspect(value: string): string[] {
  const parts = value.trim().split('-');
  const issues: string[] = [];
  if (parts.length !== 4)
    return ['Traceparent must have version-trace-id-parent-id-flags separated by hyphens'];
  const [version, traceId, parentId, flags] = parts;
  if (!version || !/^[0-9a-f]{2}$/i.test(version))
    issues.push('Version must be exactly two hexadecimal characters');
  if (!traceId || traceId.length !== 32 || !HEX.test(traceId) || /^0+$/.test(traceId))
    issues.push('Trace ID must be 32 hexadecimal characters and not all zero');
  if (!parentId || parentId.length !== 16 || !HEX.test(parentId) || /^0+$/.test(parentId))
    issues.push('Parent ID must be 16 hexadecimal characters and not all zero');
  if (!flags || !/^[0-9a-f]{2}$/i.test(flags))
    issues.push('Trace flags must be exactly two hexadecimal characters');
  return issues;
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported traceparent mode.');
  if (mode === 'build') {
    const version = String(options.version).trim().toLowerCase();
    const traceId = String(options.traceId).trim().toLowerCase();
    const parentId = String(options.parentId).trim().toLowerCase();
    const flags = String(options.flags).trim().toLowerCase();
    const value = `${version}-${traceId}-${parentId}-${flags}`;
    const issues = inspect(value);
    if (issues.length) throw new ToolError(issues[0]!);
    return {
      output: value,
      render: 'code',
      language: 'http',
      filename: 'traceparent.txt',
      stats: { version, sampled: flags.endsWith('1') ? 'yes' : 'no' },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Traceparent', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a W3C traceparent value.'],
    };
  const issues = inspect(input.text);
  const flags = input.text.trim().split('-')[3] ?? '';
  const sampled = /^[0-9a-f]{2}$/i.test(flags) && (Number.parseInt(flags, 16) & 1) === 1;
  return {
    output: JSON.stringify({
      headers: ['Traceparent', 'Status', 'Assessment'],
      rows: [
        [
          input.text.trim(),
          issues.length ? 'Invalid' : 'Valid',
          issues.join('; ') || `W3C Trace Context value; sampled flag ${sampled ? 'set' : 'clear'}`,
        ],
      ],
    }),
    render: 'table',
    stats: {
      valid: issues.length ? 'no' : 'yes',
      issues: issues.length,
      sampled: sampled ? 'yes' : 'no',
    },
    notes: issues.length
      ? issues
      : [
          'Trace context identifies propagation state; it does not itself contain tracing data or prove a request was sampled.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
