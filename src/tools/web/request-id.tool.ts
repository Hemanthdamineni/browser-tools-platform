import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './request-id.meta';

const HEX_RE = /^[0-9a-f]{16}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function analyze(input: TextRunInput): TextRunResult {
  const value = input.text.trim();
  if (!value)
    return {
      output: JSON.stringify({ headers: ['Header', 'Value', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste an X-Request-ID value to analyze, or use Generate mode.'],
    };
  const uuid = UUID_RE.test(value);
  const hex = HEX_RE.test(value.toLowerCase());
  const plausible = uuid || hex || value.length >= 8;
  const issues: string[] = [];
  if (!plausible)
    issues.push(
      'Value is short or contains unexpected characters; request IDs are typically a UUID or a 32+ hex token.',
    );
  if (value.length > 128)
    issues.push(`Value is ${value.length} chars; very long IDs bloat logs and headers.`);
  const assessment = uuid
    ? 'UUIDv4/vN — strong correlation ID'
    : hex
      ? '16-char hex token — acceptable, consider a UUID for full entropy'
      : 'Custom token — ensure uniqueness and log it';
  return {
    output: JSON.stringify({
      headers: ['Header', 'Value', 'Status', 'Assessment'],
      rows: [
        [
          String(input.options.header ?? 'X-Request-ID'),
          value,
          issues.length ? 'Review' : 'Valid',
          assessment,
        ],
      ],
    }),
    render: 'table',
    stats: { length: value.length, uuid: uuid ? 'yes' : 'no', hexToken: hex ? 'yes' : 'no' },
    notes: issues.length
      ? issues
      : [
          'Echo this same value back in the response header (e.g. X-Request-ID) and include it in request logs with the timestamp and route for full correlation.',
        ],
  };
}
function handleGenerate(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format);
  const header = String(options.header);
  const cryptoObj = globalThis.crypto;
  let id: string;
  if (format === 'token') {
    const buf = new Uint8Array(8);
    cryptoObj.getRandomValues(buf);
    id = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    const buf = new Uint8Array(16);
    cryptoObj.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    const hex = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return {
    output: `${header}: ${id}`,
    render: 'code',
    language: 'http',
    filename: 'request-id.txt',
    stats: { format, header, length: id.length },
  };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode === 'generate') return handleGenerate(input);
  if (mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  return analyze(input);
}
const tool: TextToolModule = { meta, run };
export default tool;
