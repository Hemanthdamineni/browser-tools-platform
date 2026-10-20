import { describe, expect, it } from 'vitest';
import tool from './http-request-builder.tool';

type Result = { output: string; render?: string; language?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('http-request-builder', () => {
  it('builds a GET with Host from the URL', async () => {
    const r = await run('', { method: 'GET', url: 'https://api.example.com/items?page=1' });
    expect(r.output).toBe('GET /items?page=1 HTTP/1.1\r\nHost: api.example.com\r\n\r\n');
  });

  it('adds Content-Length for a POST body', async () => {
    const r = await run('', {
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: 'Content-Type: application/json',
      body: '{"name":"Ada"}',
    });
    const out = r.output;
    expect(out.startsWith('POST /users HTTP/1.1\r\n')).toBe(true);
    expect(out).toContain('Host: api.example.com');
    expect(out).toContain('Content-Type: application/json');
    expect(out).toContain('Content-Length: ' + new TextEncoder().encode('{"name":"Ada"}').length);
    expect(out.endsWith('\r\n\r\n{"name":"Ada"}\r\n')).toBe(true);
  });

  it('keeps the user Host when provided and skips auto Content-Length for GET', async () => {
    const r = await run('', { method: 'GET', url: 'https://a.example/x', headers: 'Host: custom.example' });
    expect(r.output).toContain('Host: custom.example');
    expect(r.output).not.toContain('Host: a.example');
    expect(r.output).not.toContain('Content-Length');
  });

  it('handles a relative path without a host', async () => {
    const r = await run('', { method: 'GET', url: '/health?deep=1' });
    expect(r.output).toBe('GET /health?deep=1 HTTP/1.1\r\n\r\n');
  });

  it('normalizes body line endings to CRLF', async () => {
    const r = await run('', { method: 'POST', url: 'https://x.example/api', body: 'a\nb' });
    expect(r.output).toContain('\r\n\r\na\r\nb\r\n');
  });

  it('rejects empty URL and unknown method', async () => {
    await expect(run('', { url: '  ' })).rejects.toThrow(/provide a url/i);
    await expect(run('', { url: 'https://x.example', method: 'TRACE' })).rejects.toThrow(/unsupported method/i);
  });
});
