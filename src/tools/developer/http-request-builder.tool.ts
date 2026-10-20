import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './http-request-builder.meta';

const MAX_LEN = 200_000;

interface ParsedUrl {
  host: string;
  path: string;
}

function parseTarget(raw: string): ParsedUrl {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    return { host: u.host, path: (u.pathname || '/') + u.search };
  } catch {
    // Relative path — no host available.
    const [pathPart, queryPart] = trimmed.split('?', 2);
    return { host: '', path: (pathPart || '/') + (queryPart ? '?' + queryPart : '') };
  }
}

function headersList(raw: string): string[] {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

function headerKey(line: string): string {
  const i = line.indexOf(':');
  return i === -1 ? '' : line.slice(0, i).trim().toLowerCase();
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const method = String(o.method ?? 'GET').toUpperCase();
  const version = String(o.version ?? '1.1');
  const rawUrl = String(o.url ?? '').trim();
  const autoLength = o.autoLength !== false;
  const addHost = o.addHost !== false;

  if (!rawUrl) throw new ToolError('Provide a URL or path for the request.');
  if (rawUrl.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');
  if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)) {
    throw new ToolError('Unsupported method.', 'GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS.');
  }

  const { host, path } = parseTarget(rawUrl);
  const extra = headersList(String(o.headers ?? ''));
  const lines: string[] = [];

  lines.push(method + ' ' + path + ' HTTP/' + version);

  const keys = new Set(extra.map(headerKey).filter(Boolean));
  let sawHost = false;
  for (const line of extra) {
    if (headerKey(line) === 'host') sawHost = true;
  }
  if (addHost && host && !sawHost) lines.push('Host: ' + host);
  lines.push(...extra);

  const body = String(o.body ?? '');
  const normalizedBody = body.replace(/\r?\n/g, '\r\n');
  if (
    autoLength &&
    normalizedBody &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    !keys.has('content-length')
  ) {
    lines.push('Content-Length: ' + byteLength(normalizedBody));
  }

  const head = lines.join('\r\n');
  const raw = head + '\r\n\r\n' + (normalizedBody ? normalizedBody + '\r\n' : '');

  return {
    output: raw,
    render: 'text',
    language: 'text',
    stats: { lines: lines.length, bodyBytes: byteLength(normalizedBody) },
    notes: [
      method + ' ' + (host || '(relative)') + path,
      autoLength && normalizedBody && method !== 'GET' && method !== 'HEAD'
        ? 'Content-Length set from the body (' + byteLength(normalizedBody) + ' bytes).'
        : 'No Content-Length added.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
