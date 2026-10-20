import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-type.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-type', () => {
  it('builds JSON and multipart headers', () => {
    expect(run('', { mode: 'build', mediaType: 'application/json', charset: 'utf-8' }).output).toBe(
      'application/json; charset=utf-8',
    );
    expect(
      run('', {
        mode: 'build',
        mediaType: 'multipart/form-data',
        charset: '',
        boundary: '----boundary',
      }).output,
    ).toBe('multipart/form-data; boundary="----boundary"');
  });

  it('parses quoted parameters and preserves values', () => {
    const result = run(
      'multipart/form-data; boundary="----formBoundary7MA4YWxkTrZu0gW"; charset=utf-8',
    );
    expect(rows(result)).toContainEqual([
      'multipart/form-data',
      'boundary',
      '----formBoundary7MA4YWxkTrZu0gW',
      '',
    ]);
    expect(result.stats?.review).toBe(0);
  });

  it('flags missing multipart boundary and duplicate parameters', () => {
    const result = run(
      'multipart/form-data; charset=utf-8\ntext/plain; charset=utf-8; charset=ascii',
    );
    expect(result.stats?.review).toBe(2);
    expect(rows(result)[0]?.[3]).toContain('boundary');
    expect(rows(result).some((row) => row[3]?.includes('Duplicate'))).toBe(true);
  });

  it('handles malformed media types', () => {
    const result = run('not-a-media-type');
    expect(result.stats?.invalid).toBe(1);
    expect(rows(result)[0]?.[3]).toBe('Invalid media type');
  });

  it('rejects unsafe generated values', () => {
    expect(() => run('', { mode: 'build', mediaType: 'application' })).toThrow(ToolError);
    expect(() =>
      run('', { mode: 'build', mediaType: 'multipart/form-data', boundary: '' }),
    ).toThrow(ToolError);
    expect(() => run('', { mode: 'build', mediaType: 'text/plain', charset: 'utf 8' })).toThrow(
      ToolError,
    );
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
