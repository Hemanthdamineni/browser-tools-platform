import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './network-error-logging.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('network-error-logging', () => {
  it('builds a valid policy JSON', () => {
    const result = run('', {
      mode: 'build',
      report_to: 'default',
      max_age: '2592000',
      include_subdomains: 'true',
      failure_mode: 'fail-open',
      success_fraction: '0.1',
    });
    const policy = JSON.parse(result.output);
    expect(policy.report_to).toBe('default');
    expect(policy.max_age).toBe(2592000);
    expect(result.filename).toBe('nel-policy.json');
  });

  it('analyzes a valid policy', () => {
    const input =
      '{"report_to":"default","max_age":2592000,"include_subdomains":true,"failure_mode":"fail-open","success_fraction":0.1}';
    const result = run(input);
    expect(result.stats?.issues).toBe(0);
    expect(result.stats?.fields).toBeGreaterThanOrEqual(3);
  });

  it('flags missing required fields and enum errors', () => {
    const result = run('{"max_age":2592000,"failure_mode":"fail-closedo"}');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('report_to');
    expect(result.notes?.join(' ')).toContain('failure_mode');
  });

  it('validates success_fraction range and types', () => {
    expect(run('{"report_to":"d","max_age":1,"success_fraction":7}').stats?.issues).toBeGreaterThan(
      0,
    );
    expect(
      run('{"report_to":"d","max_age":1,"include_subdomains":"yes"}').stats?.issues,
    ).toBeGreaterThan(0);
  });

  it('rejects invalid generated values', () => {
    expect(() => run('', { mode: 'build', report_to: '', max_age: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', report_to: 'x', max_age: 'abc' })).toThrow(ToolError);
  });

  it('handles blank and malformed analysis', () => {
    expect(run('').notes?.[0]).toContain('Paste');
    expect(run('not json').stats?.issues).toBeGreaterThan(0);
  });
});
