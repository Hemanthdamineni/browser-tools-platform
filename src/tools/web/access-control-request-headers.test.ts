import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './access-control-request-headers.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('access-control-request-headers', () => {
  it('builds a preflight header block', () => {
    const result = run('', { mode: 'build', method: 'PATCH', headers: 'Content-Type, X-Token' });
    expect(result.output).toBe('Access-Control-Request-Method: PATCH\nAccess-Control-Request-Headers: Content-Type, X-Token');
    expect(result.filename).toBe('access-control-request-headers.txt');
  });

  it('analyzes a valid preflight', () => {
    const result = run('Access-Control-Request-Method: PATCH\nAccess-Control-Request-Headers: Content-Type, X-Token');
    expect(result.stats?.method).toBe('PATCH');
    expect(result.stats?.headers).toBe(2);
    expect(result.stats?.issues).toBe(0);
  });

  it('flags safelisted methods and forbidden headers', () => {
    const a = run('Access-Control-Request-Method: GET');
    expect(a.notes?.join(' ')).toContain('safelisted');
    const b = run('Access-Control-Request-Method: PUT\nAccess-Control-Request-Headers: Cookie');
    expect(b.notes?.join(' ')).toContain('forbidden');
  });

  it('flags null origin', () => {
    const result = run('Access-Control-Request-Method: PATCH\nOrigin: null');
    expect(result.notes?.join(' ')).toContain('null');
  });

  it('flags invalid method tokens and missing method', () => {
    const a = run('Access-Control-Request-Method: 9bad');
    expect(a.stats?.issues).toBeGreaterThan(0);
    const b = run('Access-Control-Request-Headers: X-Token');
    expect(b.notes?.join(' ')).toContain('missing');
  });

  it('rejects invalid build and handles blank analysis', () => {
    expect(() => run('', { mode: 'build', method: 'PATCH', headers: 'Cookie' })).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
