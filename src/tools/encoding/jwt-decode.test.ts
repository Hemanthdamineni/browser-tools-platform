import { describe, it, expect } from 'vitest';
import tool from './jwt-decode.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as {
    output: string;
    notes?: string[];
    stats?: Record<string, string | number>;
  };

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeToken = (header: unknown, payload: unknown) =>
  `${b64url(header)}.${b64url(payload)}.signature`;

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('jwt-decode', () => {
  it('decodes header and payload of the sample token', () => {
    const out = run(SAMPLE).output;
    expect(out).toBe(
      '// header\n{\n  "alg": "HS256",\n  "typ": "JWT"\n}\n\n// payload\n{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}',
    );
  });

  it('reports the algorithm in stats', () => {
    expect(run(SAMPLE).stats).toEqual({ algorithm: 'HS256', type: 'JWT' });
  });

  it('renders iat as a UTC date', () => {
    const notes = run(SAMPLE).notes ?? [];
    expect(notes.some((n) => n.includes('iat (issued at): 2018-01-18 01:30:22 UTC'))).toBe(true);
  });

  it('always notes that the signature is not verified', () => {
    expect((run(SAMPLE).notes ?? []).some((n) => /not verified/i.test(n))).toBe(true);
  });

  it('flags an expired token', () => {
    const notes = run(makeToken({ alg: 'HS256' }, { exp: 1000000000 })).notes ?? [];
    expect(notes.some((n) => n.startsWith('exp (expires):') && n.includes('has expired'))).toBe(
      true,
    );
  });

  it('flags a token that is not yet expired', () => {
    const notes = run(makeToken({ alg: 'HS256' }, { exp: 4102444800 })).notes ?? [];
    expect(notes.some((n) => n.includes('not yet expired'))).toBe(true);
  });

  it('part: header only', () => {
    expect(run(SAMPLE, { part: 'header' }).output).toBe(
      '// header\n{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
    );
  });

  it('part: payload only', () => {
    const out = run(SAMPLE, { part: 'payload' }).output;
    expect(out.startsWith('// payload')).toBe(true);
    expect(out.includes('// header')).toBe(false);
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
  });

  it('throws when the token does not have three parts', () => {
    expect(() => run('abc.def')).toThrow(ToolError);
    expect(() => run('abc.def')).toThrow(/three dot-separated parts/i);
  });

  it('throws on a segment that is not valid base64url', () => {
    expect(() => run('@@@@.@@@@.sig')).toThrow(ToolError);
  });

  it('throws when a segment is valid base64 but not JSON', () => {
    // "hello" base64url-encoded is not a JSON value
    expect(() => run('aGVsbG8.aGVsbG8.sig')).toThrow(/not valid JSON/i);
  });
});
