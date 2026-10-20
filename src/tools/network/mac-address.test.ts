import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './mac-address.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('mac-address', () => {
  it('normalizes a colon MAC', () => {
    const result = run('3c:22:fb:9c:11:d4');
    expect(result.stats?.valid).toBe('yes');
    const out = JSON.parse(result.output) as { rows: string[][] };
    expect(out.rows[0]?.[1]).toBe('3C:22:FB:9C:11:D4');
  });

  it('accepts dash notation as valid', () => {
    expect(run('3c-22-fb-9c-11-d4').stats?.valid).toBe('yes');
  });

  it('accepts Cisco dot notation as valid', () => {
    expect(run('3c22.fb9c.11d4').stats?.valid).toBe('yes');
  });

  it('detects multicast and locally-administered bits', () => {
    const marked = run('01:00:5e:00:00:01'); // multicast
    expect(marked.stats?.multicast).toBe('yes');
    const local = run('02:00:00:00:00:00');
    expect(local.stats?.local).toBe('yes');
  });

  it('converts to EUI-64 with U/L toggled and fffe inserted', () => {
    const result = run('00:11:22:33:44:55', { mode: 'eui64' });
    expect(result.output).toBe('02:11:22:FF:FE:33:44:55');
  });

  it('rejects malformed input and handles blank', () => {
    expect(() => run('xyz')).toThrow(ToolError);
    expect(() => run('00:11:22')).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
