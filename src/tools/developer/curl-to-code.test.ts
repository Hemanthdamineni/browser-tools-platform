import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './curl-to-code.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  warnings?: string[];
  stats?: Record<string, string | number>;
};

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

const TARGETS = [
  'fetch',
  'axios',
  'node',
  'python',
  'go',
  'php',
  'ruby',
  'java',
  'csharp',
  'rust',
  'powershell',
  'http',
];

describe('curl-to-code', () => {
  it('renders an exact fetch snippet for a plain GET', () => {
    const result = run('curl https://example.com/api');
    expect(result.output).toBe(
      [
        'async function main() {',
        '  const res = await fetch("https://example.com/api", {',
        '    method: "GET",',
        '    redirect: "manual",',
        '  });',
        '  if (!res.ok) throw new Error(`HTTP ${res.status}`);',
        '  console.log(await res.text());',
        '}',
        '',
        'main().catch(console.error);',
      ].join('\n'),
    );
    expect(result.render).toBe('code');
    expect(result.language).toBe('javascript');
    expect(result.stats).toMatchObject({
      method: 'GET',
      format: 'fetch',
      headers: 0,
      body: 'none',
    });
  });

  it('infers POST from a data body and defaults the content type', () => {
    const result = run("curl -d 'a=1&b=2' https://example.com/form");
    expect(result.output).toContain('method: "POST"');
    expect(result.output).toContain('"Content-Type": "application/x-www-form-urlencoded"');
    expect(result.output).toContain('"a=1&b=2"');
    expect(result.stats?.method).toBe('POST');
  });

  it('handles -X, attached short values and custom headers', () => {
    const result = run("curl -XPUT -H 'X-Trace: abc' https://example.com/put");
    expect(result.output).toContain('method: "PUT"');
    expect(result.output).toContain('"X-Trace": "abc"');
  });

  it('moves -d data into the query string with -G', () => {
    const result = run("curl -G -d 'a=1' -d 'b=2' https://example.com/search");
    expect(result.output).toContain('https://example.com/search?a=1&b=2');
    expect(result.stats?.method).toBe('GET');
    expect(result.stats?.body).toBe('none');
  });

  it('percent-encodes --data-urlencode values', () => {
    const result = run("curl --data-urlencode 'q=hello world' https://example.com");
    expect(result.output).toContain('"q=hello%20world"');
  });

  it('builds a Basic Authorization header from -u', () => {
    const result = run('curl -u user:pass https://example.com');
    expect(result.output).toContain('"Authorization": "Basic dXNlcjpwYXNz"');
    expect(result.warnings?.join(' ')).toMatch(/credentials/i);
  });

  it('uses HEAD for -I and sets --json content negotiation', () => {
    expect(run('curl -I https://example.com').output).toContain('method: "HEAD"');
    const json = run('curl --json \'{"a":1}\' https://example.com');
    expect(json.output).toContain('"Content-Type": "application/json"');
    expect(json.output).toContain('"Accept": "application/json"');
    expect(json.output).toContain(JSON.stringify('{"a":1}'));
  });

  it('models multipart forms and warns about file parts', () => {
    const result = run('curl -F name=holiday -F file=@photo.png https://upload.example.com');
    expect(result.output).toContain('form.append("name", "holiday")');
    expect(result.output).toContain('photo.png');
    expect(result.stats?.body).toBe('multipart');
    expect(result.stats?.fields).toBe(2);
    expect(result.warnings?.join(' ')).toMatch(/file uploads/i);
  });

  it('adds cookies, user agent and referer as headers', () => {
    const result = run(
      'curl -b "sid=1; theme=dark" -A "MyBot/1.0" -e https://ref.example https://example.com',
    );
    expect(result.output).toContain('"Cookie": "sid=1; theme=dark"');
    expect(result.output).toContain('"User-Agent": "MyBot/1.0"');
    expect(result.output).toContain('"Referer": "https://ref.example"');
  });

  it('translates the same request across every target', () => {
    const source =
      "curl -X POST -H 'Accept: application/json' -d 'q=x' https://api.example.com/graphql";
    for (const target of TARGETS) {
      const result = run(source, { target });
      expect(result.output, target).toContain('example.com');
      expect(result.output.length, target).toBeGreaterThan(40);
      expect(result.stats?.format, target).toBe(target);
      expect(result.language, target).toBeTruthy();
    }
  });

  it('emits idiomatic constructs for each language', () => {
    const source =
      'curl -X POST -H "Content-Type: application/json" -d \'{"a":1}\' https://api.example.com';
    expect(run(source, { target: 'fetch' }).output).toContain('await fetch(');
    expect(run(source, { target: 'axios' }).output).toContain('require("axios")');
    expect(run(source, { target: 'node' }).output).toContain('require("https")');
    expect(run(source, { target: 'python' }).output).toContain('import requests');
    expect(run(source, { target: 'go' }).output).toContain('package main');
    expect(run(source, { target: 'php' }).output).toContain('curl_init');
    expect(run(source, { target: 'ruby' }).output).toContain('Net::HTTP::Post');
    expect(run(source, { target: 'java' }).output).toContain('HttpRequest.newBuilder()');
    expect(run(source, { target: 'csharp' }).output).toContain('new HttpClient()');
    expect(run(source, { target: 'rust' }).output).toContain('reqwest::Client');
    expect(run(source, { target: 'powershell' }).output).toContain('Invoke-RestMethod');
    expect(run(source, { target: 'http' }).output).toContain('POST / HTTP/1.1');
  });

  it('handles bash, cmd and PowerShell line continuations', () => {
    expect(run('curl https://example.com \\\n  -H "X-A: 1"').output).toContain('"X-A": "1"');
    expect(run('curl https://example.com ^\n  -H "X-B: 2"').output).toContain('"X-B": "2"');
    expect(run('curl https://example.com `\n  -H "X-C: 3"').output).toContain('"X-C": "3"');
  });

  it('maps -k and -m into language-specific options', () => {
    const py = run('curl -k -m 5 https://example.com', { target: 'python' });
    expect(py.output).toContain('verify=False');
    expect(py.output).toContain('timeout=5');
  });

  it('follows redirects only when -L is present', () => {
    expect(run('curl https://example.com').output).toContain('redirect: "manual"');
    expect(run('curl -L https://example.com').output).not.toContain('redirect: "manual"');
  });

  it('reports unsupported transport flags instead of dropping them silently', () => {
    const result = run('curl --resolve example.com:443:1.2.3.4 https://example.com');
    expect(result.warnings?.join(' ')).toMatch(/--resolve/);
  });

  it('warns when a body is read from a file', () => {
    const result = run('curl -d @payload.json https://example.com');
    expect(result.warnings?.join(' ')).toMatch(/cannot be read/i);
  });

  it('returns empty output for blank input', () => {
    expect(run('   \n  ').output).toBe('');
  });

  it('rejects input that is not a curl command', () => {
    expect(() => run('wget https://example.com')).toThrow(ToolError);
  });

  it('rejects a command with no URL', () => {
    expect(() => run('curl -X POST -H "A: b"')).toThrow(/url/i);
  });

  it('rejects an unknown output format and oversized input', () => {
    expect(() => run('curl https://example.com', { target: 'unknown' })).toThrow(ToolError);
    expect(() => run(`curl https://example.com ${'x'.repeat(200_001)}`)).toThrow(/too long/i);
  });
});
