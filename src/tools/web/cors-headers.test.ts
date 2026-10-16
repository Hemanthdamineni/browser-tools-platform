import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cors-headers.tool';

type Result = {
  output: string;
  filename?: string;
  render?: string;
  language?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('cors-headers build', () => {
  it('builds a complete policy from defaults', () => {
    const result = run('', { mode: 'build', target: 'all' });
    expect(result.filename).toBe('cors-headers.txt');
    expect(result.language).toBe('http');
    expect(result.stats?.headers).toBe(5);
    const output = result.output;
    expect(output).toContain('Access-Control-Allow-Origin: https://app.example.com');
    expect(output).toContain('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
    expect(output).toContain('Access-Control-Allow-Headers: Content-Type, Authorization');
    expect(output).toContain('Access-Control-Expose-Headers: X-Request-Id, X-Rate-Limit');
    expect(output).toContain('Access-Control-Max-Age: 600');
    expect(output).not.toContain('Access-Control-Allow-Credentials');
    expect(result.notes?.join(' ')).toContain('Vary: Origin');
  });

  it('adds the credentials header when enabled', () => {
    const result = run('', {
      mode: 'build',
      target: 'all',
      credentials: true,
      origin: 'https://app.example.com',
    });
    expect(result.output).toContain('Access-Control-Allow-Credentials: true');
    expect(result.stats?.headers).toBe(6);
  });

  it('emits each individual header on request', () => {
    expect(run('', { mode: 'build', target: 'allow-origin', origin: '*' }).output).toBe(
      'Access-Control-Allow-Origin: *',
    );
    expect(run('', { mode: 'build', target: 'allow-credentials', credentials: true }).output).toBe(
      'Access-Control-Allow-Credentials: true',
    );
    expect(run('', { mode: 'build', target: 'allow-methods', methods: 'GET, HEAD' }).output).toBe(
      'Access-Control-Allow-Methods: GET, HEAD',
    );
    expect(
      run('', { mode: 'build', target: 'allow-headers', headers: 'Content-Type' }).output,
    ).toBe('Access-Control-Allow-Headers: Content-Type');
    expect(
      run('', { mode: 'build', target: 'expose-headers', expose: 'X-Total-Count' }).output,
    ).toBe('Access-Control-Expose-Headers: X-Total-Count');
    expect(run('', { mode: 'build', target: 'max-age', maxAge: '0' }).output).toBe(
      'Access-Control-Max-Age: 0',
    );
  });

  it('rejects a wildcard origin combined with credentials', () => {
    expect(() => run('', { mode: 'build', target: 'all', origin: '*', credentials: true })).toThrow(
      ToolError,
    );
    expect(() =>
      run('', { mode: 'build', target: 'allow-origin', origin: '*', credentials: true }),
    ).toThrow(ToolError);
  });

  it('rejects wildcard method and header lists combined with credentials', () => {
    expect(() =>
      run('', { mode: 'build', target: 'allow-methods', methods: '*', credentials: true }),
    ).toThrow(ToolError);
    expect(() =>
      run('', {
        mode: 'build',
        target: 'all',
        origin: 'https://a.example.com',
        credentials: true,
        methods: '*',
      }),
    ).toThrow(ToolError);
  });

  it('rejects malformed method and header tokens', () => {
    expect(() => run('', { mode: 'build', target: 'allow-methods', methods: 'GET; POST' })).toThrow(
      ToolError,
    );
    expect(() => run('', { mode: 'build', target: 'allow-methods', methods: 'GET, GET' })).toThrow(
      ToolError,
    );
    expect(() =>
      run('', { mode: 'build', target: 'allow-headers', headers: 'bad header' }),
    ).toThrow(ToolError);
    expect(() => run('', { mode: 'build', target: 'expose-headers', expose: '' })).toThrow(
      ToolError,
    );
  });

  it('rejects negative, non-integer and oversized max-age values', () => {
    expect(() => run('', { mode: 'build', target: 'max-age', maxAge: '-5' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', target: 'max-age', maxAge: 'abc' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', target: 'max-age', maxAge: '9999999' })).toThrow(
      ToolError,
    );
  });

  it('rejects credential header when credentials are off', () => {
    expect(() =>
      run('', { mode: 'build', target: 'allow-credentials', credentials: false }),
    ).toThrow(/only supports true/);
  });

  it('rejects an invalid origin and unsupported selectors', () => {
    expect(() =>
      run('', { mode: 'build', target: 'allow-origin', origin: 'not an origin' }),
    ).toThrow(ToolError);
    expect(() =>
      run('', { mode: 'build', target: 'allow-origin', origin: 'a.example.com, b.example.com' }),
    ).toThrow(ToolError);
    expect(() => run('', { mode: 'nonsense' })).toThrow(/supported CORS mode/);
    expect(() => run('', { mode: 'build', target: 'unknown' })).toThrow(/supported header/);
  });
});

describe('cors-headers analyze', () => {
  it('returns an empty table with guidance for blank input', () => {
    const result = run('');
    expect(result.render).toBe('table');
    expect(rows(result)).toEqual([]);
    expect(result.notes?.[0]).toContain('Paste');
  });

  it('analyzes a bare wildcard origin', () => {
    const result = run('*');
    expect(result.stats).toMatchObject({ headers: 1, issues: 0 });
    expect(rows(result)[0]?.[0]).toBe('Access-Control-Allow-Origin');
    expect(rows(result)[0]?.[2]).toBe('Valid');
  });

  it('flags a bare value that is not an origin', () => {
    const result = run('not an origin');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[2]).toBe('Invalid');
  });

  it('round-trips built output into a clean analysis', () => {
    const built = run('', {
      mode: 'build',
      target: 'all',
      origin: 'https://app.example.com',
      credentials: true,
      methods: 'GET, POST',
      headers: 'Content-Type, Authorization',
      expose: 'X-Request-Id',
      maxAge: '600',
    });
    const parsed = run(built.output);
    expect(parsed.stats?.headers).toBe(6);
    expect(parsed.stats?.issues).toBe(0);
    expect(rows(parsed).every((row) => row[2] === 'Valid')).toBe(true);
  });

  it('flags the wildcard-with-credentials conflict across a header block', () => {
    const result = run(
      'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true\nAccess-Control-Allow-Methods: *',
    );
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('cannot be *');
  });

  it('flags duplicate header lines and invalid values', () => {
    const result = run(
      'Access-Control-Allow-Origin: https://a.example.com\nAccess-Control-Allow-Origin: https://b.example.com\nAccess-Control-Max-Age: seven',
    );
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ').toLowerCase()).toContain('duplicate');
    expect(rows(result).some((row) => row[2] === 'Invalid')).toBe(true);
  });

  it('analyzes a header block covering every CORS header', () => {
    const result = run(
      [
        'Access-Control-Allow-Origin: https://app.example.com',
        'Access-Control-Allow-Credentials: true',
        'Access-Control-Allow-Methods: GET, POST',
        'Access-Control-Allow-Headers: Content-Type, Authorization',
        'Access-Control-Expose-Headers: X-Request-Id',
        'Access-Control-Max-Age: 600',
      ].join('\n'),
    );
    expect(result.stats).toMatchObject({ headers: 6, issues: 0 });
    expect(rows(result).map((row) => row[0])).toEqual([
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers',
      'Access-Control-Expose-Headers',
      'Access-Control-Max-Age',
    ]);
  });

  it('flags an invalid method token inside a header block', () => {
    const result = run('Access-Control-Allow-Methods: GET; POST');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(rows(result)[0]?.[2]).toBe('Invalid');
  });

  it('treats a bare column of numbers as Max-Age values', () => {
    const result = run('600\n-5\nnot-a-number');
    expect(result.stats?.headers).toBe(3);
    // '600' is valid, the other two are not.
    expect(rows(result).map((row) => row[2])).toEqual(['Valid', 'Invalid', 'Invalid']);
  });

  it('rejects oversized input', () => {
    expect(() => run('x'.repeat(100_001))).toThrow(/too large/);
  });
});
