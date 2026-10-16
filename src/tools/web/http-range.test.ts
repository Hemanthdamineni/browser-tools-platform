import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './http-range.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('http-range', () => {
  it('builds Range, open Range, Content-Range, and Accept-Ranges headers', () => {
    expect(run('', { mode: 'build', header: 'range', start: 0, end: 99 }).output).toBe('bytes=0-99');
    expect(run('', { mode: 'build', header: 'range', start: 100, end: -1 }).output).toBe('bytes=100-');
    expect(run('', { mode: 'build', header: 'content-range', start: 100, end: 199, size: 1000 }).output).toBe('bytes 100-199/1000');
    expect(run('', { mode: 'build', header: 'accept-ranges' }).output).toBe('bytes');
  });

  it('parses bounded, open, and suffix ranges with known size', () => {
    const result = run('bytes=0-99\nbytes=100-\nbytes=-50', { size: 1000 });
    expect(rows(result)[0]?.[3]).toBe('Valid byte range');
    expect(rows(result)[1]?.[1]).toBe('100');
    expect(rows(result)[2]?.[1]).toBe('suffix');
    expect(rows(result)[2]?.[2]).toBe('999');
  });

  it('parses and validates Content-Range values', () => {
    const result = run('bytes 0-99/1000\nbytes 100-199/*\nbytes 200-100/1000');
    expect(rows(result)[0]?.[3]).toBe('Valid Content-Range');
    expect(rows(result)[1]?.[3]).toBe('Valid Content-Range');
    expect(rows(result)[2]?.[3]).toContain('End precedes');
  });

  it('flags unsatisfiable and malformed ranges', () => {
    const result = run('bytes=1000-1100\nbytes=20-10\nnot-a-range', { size: 1000 });
    expect(result.stats?.invalid).toBe(1);
    expect(rows(result)[0]?.[3]).toContain('unsatisfiable');
    expect(rows(result)[1]?.[3]).toContain('greater');
  });

  it('rejects invalid generated ranges', () => {
    expect(() => run('', { mode: 'build', header: 'range', start: 20, end: 10 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', header: 'content-range', start: 0, end: 10, size: 0 })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', header: 'content-range', start: 0, end: 100, size: 100 })).toThrow(ToolError);
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
