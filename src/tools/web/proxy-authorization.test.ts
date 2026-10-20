import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './proxy-authorization.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('proxy-authorization', () => {
  it('builds Basic proxy credentials locally', () => {
    const result = run('', { mode: 'build', scheme: 'Basic', username: 'user', password: 'pass' });
    expect(result.output).toBe('Basic dXNlcjpwYXNz');
    expect(result.filename).toBe('proxy-authorization.txt');
  });

  it('builds and analyzes Bearer credentials', () => {
    const built = run('', { mode: 'build', scheme: 'Bearer', token: 'proxy-token' });
    expect(built.output).toBe('Bearer proxy-token');
    const analyzed = run(built.output);
    expect(analyzed.stats).toMatchObject({ credentials: 1, invalid: 0, review: 0 });
    expect(rows(analyzed)[0]?.[0]).toBe('bearer');
  });

  it('flags unsupported schemes and invalid Basic encoding', () => {
    expect(rows(run('Digest abc'))[0]?.[3]).toContain('Unsupported');
    expect(rows(run('Basic not-base64'))[0]?.[3]).toContain('Base64');
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', scheme: 'Basic', username: '', password: '' })).toThrow(
      ToolError,
    );
    expect(() => run('', { mode: 'build', scheme: 'Bearer', token: 'bad token' })).toThrow(
      ToolError,
    );
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('not-a-credential'))[0]?.[2]).toBe('Invalid');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('encodes UTF-8 Basic credentials', () => {
    expect(
      run('', { mode: 'build', scheme: 'Basic', username: 'usér', password: 'päss' }).output,
    ).toContain('Basic ');
  });
});
