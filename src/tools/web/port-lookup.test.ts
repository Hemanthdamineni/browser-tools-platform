import { describe, it, expect } from 'vitest';
import tool from './port-lookup.tool';
import { ToolError } from '@/lib/types';

const run = (text: string) => tool.run({ text, options: {} });
const table = (r: ReturnType<typeof run>) =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };

describe('port-lookup', () => {
  it('port 22 resolves to SSH over TCP', () => {
    const rows = table(run('22')).rows;
    expect(rows[0]![0]).toBe('22');
    expect(rows[0]![1]).toBe('TCP');
    expect(rows[0]![2]).toBe('SSH');
    expect(table(run('22')).headers).toEqual(['Port', 'Protocol', 'Service', 'Description']);
  });

  it('service name lookup finds redis on 6379', () => {
    const rows = table(run('redis')).rows;
    expect(rows.some((r) => r[0] === '6379' && r[2] === 'Redis')).toBe(true);
  });

  it('empty input lists the whole table (100+ rows)', () => {
    const rows = table(run('')).rows;
    expect(rows.length).toBeGreaterThan(100);
  });

  it('matches substrings case-insensitively', () => {
    const rows = table(run('postgres')).rows;
    expect(rows.some((r) => r[0] === '5432')).toBe(true);
  });

  it('unknown port returns an empty table with a note', () => {
    const r = run('65534');
    expect(table(r).rows).toEqual([]);
    expect(r.notes?.[0]).toMatch(/No well-known service/);
  });

  it('rejects out-of-range port numbers with a ToolError', () => {
    expect(() => run('99999')).toThrow(ToolError);
    expect(() => run('99999')).toThrow(/0 to 65535/);
  });

  it('TCP/UDP dual registration appears for DNS', () => {
    const rows = table(run('53')).rows;
    expect(rows[0]![1]).toBe('TCP/UDP');
  });
});
