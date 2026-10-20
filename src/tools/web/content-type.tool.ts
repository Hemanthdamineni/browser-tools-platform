import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-type.meta';

type Parsed = { mediaType: string; params: [string, string][]; issues: string[] };
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
function parse(value: string): Parsed | null {
  const parts = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const mediaType = parts.shift()?.toLowerCase();
  if (!mediaType || !/^[^/\s;]+\/[^/\s;]+$/.test(mediaType)) return null;
  const issues: string[] = [];
  const params: [string, string][] = [];
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index <= 0) {
      issues.push(`Malformed parameter: ${part}`);
      continue;
    }
    const key = part.slice(0, index).trim().toLowerCase();
    let val = part.slice(index + 1).trim();
    if (val.startsWith('"') && val.endsWith('"'))
      val = val.slice(1, -1).replace(/\\(["\\])/g, '$1');
    if (!TOKEN.test(key)) issues.push(`Invalid parameter name: ${key}`);
    params.push([key, val]);
  }
  if (mediaType.startsWith('multipart/') && !params.some(([key]) => key === 'boundary'))
    issues.push('Multipart media types require a boundary parameter');
  if (params.some(([key, val]) => key === 'charset' && !TOKEN.test(val)))
    issues.push('Charset contains invalid token characters');
  if (new Set(params.map(([key]) => key)).size !== params.length)
    issues.push('Duplicate parameters are present');
  return { mediaType, params, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'parse')
    throw new ToolError('Choose a supported Content-Type mode.');
  if (mode === 'build') {
    const mediaType = String(options.mediaType).trim().toLowerCase();
    const charset = String(options.charset).trim();
    const boundary = String(options.boundary).trim();
    if (!/^[^/\s;]+\/[^/\s;]+$/.test(mediaType))
      throw new ToolError('Media type must use type/subtype syntax, such as application/json.');
    if (charset && !TOKEN.test(charset))
      throw new ToolError('Charset must be a token such as utf-8 or iso-8859-1.');
    if (boundary && (boundary.length > 70 || /[\r\n";]/.test(boundary)))
      throw new ToolError(
        'Boundary must be at most 70 characters without quotes, semicolons, or line breaks.',
      );
    if (mediaType.startsWith('multipart/') && !boundary)
      throw new ToolError('Multipart media types require a boundary.');
    const params = [
      ...(charset ? [`charset=${charset}`] : []),
      ...(boundary ? [`boundary="${boundary}"`] : []),
    ];
    return {
      output: [mediaType, ...params].join('; '),
      render: 'code',
      language: 'http',
      filename: 'content-type.txt',
      stats: { parameters: params.length },
    };
  }
  const lines = input.text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length)
    return {
      output: JSON.stringify({ headers: ['Media type', 'Parameter', 'Value', 'Issues'], rows: [] }),
      render: 'table',
      notes: ['Paste one Content-Type value per line.'],
    };
  const parsed = lines.map(parse);
  const rows = parsed.flatMap((item, index) =>
    item
      ? [
          [item.mediaType, '(type)', item.mediaType, item.issues.join('; ') || ''],
          ...item.params.map(([key, val]) => [
            item.mediaType,
            key,
            val,
            item.issues.join('; ') || '',
          ]),
        ]
      : [[`line ${index + 1}`, '', '', 'Invalid media type']],
  );
  return {
    output: JSON.stringify({ headers: ['Media type', 'Parameter', 'Value', 'Issues'], rows }),
    render: 'table',
    stats: {
      values: lines.length,
      invalid: parsed.filter((item) => !item).length,
      review: parsed.filter((item) => item?.issues.length).length,
    },
    notes: ['Header parsing does not inspect or decode an associated body.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
