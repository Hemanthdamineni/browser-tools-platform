import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './access-control-request-headers.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const METHOD = /^[A-Z][A-Z0-9-]*$/;
const FORBIDDEN = [
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
];

function parse(text: string): { method: string; headers: string[]; issues: string[] } {
  const issues: string[] = [];
  let method = '';
  const headers: string[] = [];
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      issues.push(`Unrecognized line: ${line}`);
      continue;
    }
    const name = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (name === 'access-control-request-method') {
      if (method) issues.push('Duplicate Access-Control-Request-Method');
      method = value.toUpperCase();
      if (!METHOD.test(method)) issues.push(`Invalid method token: ${value || '(empty)'}`);
      else if (['GET', 'HEAD', 'POST'].includes(method))
        issues.push(
          `${method} is CORS-safelisted; no preflight is required for simple requests using it`,
        );
    } else if (name === 'access-control-request-headers') {
      if (headers.length) issues.push('Duplicate Access-Control-Request-Headers');
      for (const part of value
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)) {
        const lower = part.toLowerCase();
        if (!TOKEN.test(part)) issues.push(`Invalid header name: ${part}`);
        else if (FORBIDDEN.includes(lower))
          issues.push(`${part} is a forbidden request header and cannot be listed in a preflight`);
        else if (!headers.includes(lower)) headers.push(lower);
      }
    } else if (name === 'origin') {
      if (value === 'null')
        issues.push('Origin is null (sandboxed or file:// page); many servers reject it');
    } else {
      issues.push(`Not a preflight request header: ${match[1]}`);
    }
  }
  if (!method && headers.length)
    issues.push(
      'Access-Control-Request-Headers is present but Access-Control-Request-Method is missing',
    );
  return { method, headers, issues };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') {
    const method = String(o.method).trim().toUpperCase();
    const headerList = String(o.headers)
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (!METHOD.test(method)) throw new ToolError('Enter a valid HTTP method token.');
    const invalid = headerList.filter((h) => !TOKEN.test(h));
    if (invalid.length) throw new ToolError(`Invalid header name: ${invalid[0]}`);
    const forbidden = headerList.filter((h) => FORBIDDEN.includes(h.toLowerCase()));
    if (forbidden.length)
      throw new ToolError(`${forbidden[0]} is forbidden in a preflight request.`);
    const output = `Access-Control-Request-Method: ${method}\nAccess-Control-Request-Headers: ${headerList.join(', ')}`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'access-control-request-headers.txt',
      stats: { method, headers: headerList.length },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Header', 'Value', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: [
        'Paste the preflight request headers (Access-Control-Request-Method and Access-Control-Request-Headers).',
      ],
    };
  const parsed = parse(input.text);
  const rows = [
    [
      'Access-Control-Request-Method',
      parsed.method || '(missing)',
      parsed.method ? 'Valid' : 'Missing',
      parsed.method
        ? `Server must allow ${parsed.method} in Access-Control-Allow-Methods.`
        : 'A preflight must state the method of the real request.',
    ],
    [
      'Access-Control-Request-Headers',
      parsed.headers.join(', ') || '(none)',
      parsed.headers.length ? 'Valid' : 'Missing',
      parsed.headers.length
        ? `Server must cover: ${parsed.headers.join(', ')}`
        : 'No custom headers requested.',
    ],
  ];
  return {
    output: JSON.stringify({ headers: ['Header', 'Value', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      method: parsed.method || 'missing',
      headers: parsed.headers.length,
      issues: parsed.issues.length,
    },
    notes: parsed.issues.length
      ? parsed.issues
      : [
          'This is the browser-generated preflight; a matching Access-Control-Allow-Methods and Access-Control-Allow-Headers response is required or the real request is blocked.',
        ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
