import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './request-id.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('x-request-id / correlation id', () => {
  it('generates a UUIDv4 request ID header', () => {
    const result = run('', { mode: 'generate', format: 'uuid-v4', header: 'X-Request-ID' });
    expect(result.output).toMatch(
      /^X-Request-ID: [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.filename).toBe('request-id.txt');
  });

  it('generates a 16-char hex token', () => {
    const result = run('', { mode: 'generate', format: 'token', header: 'X-Correlation-ID' });
    expect(result.output).toMatch(/^X-Correlation-ID: [0-9a-f]{16}$/);
  });

  it('analyzes a valid UUID as Valid', () => {
    const result = run('550e8400-e29b-41d4-a716-446655440000');
    expect(result.stats?.uuid).toBe('yes');
    expect(result.stats?.length).toBe(36);
  });

  it('analyzes a 16-hex token', () => {
    const result = run('a1b2c3d4e5f60718');
    expect(result.stats?.hexToken).toBe('yes');
  });

  it('flags implausible values', () => {
    const result = run('x');
    expect(result.stats?.length).toBe(1);
    expect(result.notes?.join(' ')).toContain('short');
  });

  it('rejects an unsupported mode', () => {
    expect(() => run('x', { mode: 'nope' })).toThrow(ToolError);
  });
});
