import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './jwt-decode.meta';

function b64urlToBytes(segment: string): Uint8Array {
  let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) {
    throw new ToolError(
      'A token segment is not valid base64url.',
      'Check the whole JWT was pasted.',
    );
  }
  if (pad > 0) b64 += '='.repeat(4 - pad);
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new ToolError(
      'A token segment is not valid base64url.',
      'Check the whole JWT was pasted.',
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeSegment(segment: string, label: string): unknown {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(b64urlToBytes(segment));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ToolError(`The ${label} is not valid JSON.`, 'This does not look like a JWT.');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const token = input.text.trim();
  if (!token) return { output: '' };

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ToolError(
      'A JWT has three dot-separated parts: header.payload.signature.',
      `Found ${parts.length} part${parts.length === 1 ? '' : 's'}.`,
    );
  }

  const header = decodeSegment(parts[0]!, 'header');
  const payload = decodeSegment(parts[1]!, 'payload');
  const part = String(o.part);

  const sections: string[] = [];
  if (part === 'all' || part === 'header') {
    sections.push(`// header\n${JSON.stringify(header, null, 2)}`);
  }
  if (part === 'all' || part === 'payload') {
    sections.push(`// payload\n${JSON.stringify(payload, null, 2)}`);
  }

  const notes: string[] = [];
  const claims = asRecord(payload);
  if (claims) {
    if (typeof claims.iat === 'number') {
      notes.push(`iat (issued at): ${formatDate(claims.iat)}`);
    }
    if (typeof claims.nbf === 'number') {
      notes.push(`nbf (not valid before): ${formatDate(claims.nbf)}`);
    }
    if (typeof claims.exp === 'number') {
      const expired = claims.exp * 1000 < Date.now();
      notes.push(
        `exp (expires): ${formatDate(claims.exp)} — ${
          expired ? 'in the past, this token has expired' : 'in the future, not yet expired'
        }`,
      );
    }
  }
  notes.push(
    'Signature not verified. This tool only decodes the token; it cannot confirm the token is authentic.',
  );

  const stats: Record<string, string | number> = {};
  const head = asRecord(header);
  if (head) {
    if (head.alg != null) stats.algorithm = String(head.alg);
    if (head.typ != null) stats.type = String(head.typ);
  }

  return {
    output: sections.join('\n\n'),
    render: 'code',
    language: 'json',
    notes,
    stats: Object.keys(stats).length > 0 ? stats : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
