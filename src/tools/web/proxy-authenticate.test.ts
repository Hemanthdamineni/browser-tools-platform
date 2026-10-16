import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './proxy-authenticate.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('proxy-authenticate', () => {
  it('builds a Basic proxy challenge', () => {
    const result = run('', { mode: 'build', scheme: 'Basic', realm: 'corp-proxy' });
    expect(result.output).toBe('Basic realm="corp-proxy"');
    expect(result.filename).toBe('proxy-authenticate.txt');
  });

  it('builds and analyzes Bearer scope', () => {
    const built = run('', { mode: 'build', scheme: 'Bearer', realm: 'edge', scope: 'connect' });
    expect(built.output).toContain('scope="connect"');
    const analyzed = run('Bearer realm="edge", scope="connect"');
    expect(analyzed.stats).toMatchObject({ challenges: 1, invalid: 0, review: 0 });
    expect(rows(analyzed)[1]?.[1]).toBe('scope');
  });

  it('flags missing realm and unknown parameters', () => {
    const result = run('Basic, Bearer realm="edge", mystery="x"');
    expect(result.stats?.review).toBeGreaterThan(0);
    expect(rows(result).some((row) => row[3]?.includes('realm'))).toBe(true);
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', realm: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', realm: 'bad\nrealm' })).toThrow(ToolError);
  });

  it('handles malformed input and blank analysis', () => {
    expect(rows(run('not a challenge'))[0]?.[3]).toContain('Malformed');
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('escapes quoted realms', () => {
    expect(run('', { mode: 'build', realm: 'corp"proxy' }).output).toBe('Basic realm="corp\\"proxy"');
  });
});
