import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './set-cookie.meta';

type Cookie = { name: string; value: string; attributes: Map<string, string | true>; issues: string[] };

function parseLine(line: string): Cookie | null {
  const parts = line.split(';').map((part) => part.trim()).filter(Boolean);
  const first = parts.shift();
  if (!first) return null;
  const separator = first.indexOf('=');
  if (separator <= 0) return null;
  const name = first.slice(0, separator).trim();
  const value = first.slice(separator + 1).trim();
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) return null;
  const attributes = new Map<string, string | true>();
  for (const part of parts) {
    const equals = part.indexOf('=');
    const key = (equals < 0 ? part : part.slice(0, equals)).trim().toLowerCase();
    if (!key) continue;
    attributes.set(key, equals < 0 ? true : part.slice(equals + 1).trim());
  }
  const issues: string[] = [];
  if (!attributes.has('secure')) issues.push('Missing Secure');
  if (!attributes.has('httponly')) issues.push('Missing HttpOnly');
  const sameSite = String(attributes.get('samesite') ?? '').toLowerCase();
  if (!sameSite) issues.push('Missing SameSite');
  else if (!['strict', 'lax', 'none'].includes(sameSite)) issues.push('Invalid SameSite value');
  if (sameSite === 'none' && !attributes.has('secure')) issues.push('SameSite=None requires Secure in modern browsers');
  if (!attributes.has('path')) issues.push('Missing Path');
  if (attributes.has('domain') && String(attributes.get('domain')).startsWith('.')) issues.push('Leading-dot Domain is obsolete syntax');
  if (attributes.has('max-age') && !/^(?:0|[1-9]\d*)$/.test(String(attributes.get('max-age')))) issues.push('Invalid Max-Age');
  return { name, value, attributes, issues };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported cookie mode.');
  if (mode === 'build') {
    const name = String(options.name).trim();
    const value = String(options.value);
    const path = String(options.path).trim();
    const domain = String(options.domain).trim();
    const sameSite = String(options.sameSite);
    const maxAge = Number(options.maxAge);
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) throw new ToolError('Cookie name contains invalid characters.');
    if (/[\r\n;]/.test(value)) throw new ToolError('Cookie value cannot contain line breaks or semicolons.');
    if (!path || /[\r\n;]/.test(path)) throw new ToolError('Cookie Path must be a non-empty path without line breaks or semicolons.');
    if (domain && !/^[A-Za-z0-9.-]+$/.test(domain)) throw new ToolError('Cookie Domain contains invalid characters.');
    if (!['Strict', 'Lax', 'None'].includes(sameSite)) throw new ToolError('Choose Strict, Lax, or None for SameSite.');
    if (!Number.isInteger(maxAge) || maxAge < 0) throw new ToolError('Max-Age must be a non-negative whole number.');
    if (sameSite === 'None' && !options.secure) throw new ToolError('SameSite=None requires Secure.');
    const parts = [`${name}=${value}`, `Path=${path}`, `SameSite=${sameSite}`];
    if (domain) parts.push(`Domain=${domain}`);
    if (maxAge > 0) parts.push(`Max-Age=${maxAge}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    const output = parts.join('; ');
    return { output, render: 'code', language: 'http', filename: 'set-cookie.txt', stats: { attributes: parts.length - 1 }, notes: ['Generated header only; it is not sent or stored by this tool.'] };
  }

  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { output: JSON.stringify({ headers: ['Cookie', 'Result', 'Value', 'Issues'], rows: [] }), render: 'table', notes: ['Paste one Set-Cookie header per line.'] };
  const parsed = lines.map(parseLine);
  const rows = parsed.map((cookie, index) => cookie ? [cookie.name, cookie.issues.length ? 'Review' : 'Looks secure', cookie.value, cookie.issues.join('; ') || 'No common issues detected'] : [`Line ${index + 1}`, 'Invalid', '', 'Expected name=value followed by semicolon-separated attributes']);
  const review = rows.filter((row) => row[1] !== 'Looks secure').length;
  return { output: JSON.stringify({ headers: ['Cookie', 'Result', 'Value', 'Issues'], rows }), render: 'table', stats: { cookies: lines.length, review, secure: lines.length - review }, notes: ['Heuristic review only. Cookie security also depends on transport, scope, authentication design, and application behavior.'] };
}

const tool: TextToolModule = { meta, run };
export default tool;
