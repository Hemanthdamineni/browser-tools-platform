import { describe, expect, it } from 'vitest';
import tool from './sec-fetch-inspector.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string) => tool.run({ text, options: {} }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('sec-fetch-inspector', () => {
  it('analyzes a navigation request', () => {
    const result = run(
      'Sec-Fetch-Site: same-origin\nSec-Fetch-Mode: navigate\nSec-Fetch-Dest: document',
    );
    expect(result.stats?.headers).toBe(3);
    expect(result.stats?.issues).toBe(0);
    expect(rows(result)[0]?.[2]).toContain('same origin');
  });

  it('detects a cross-site navigation', () => {
    const result = run(
      'Sec-Fetch-Site: cross-site\nSec-Fetch-Mode: navigate\nSec-Fetch-Dest: document',
    );
    expect(result.stats?.crossSite).toBe('yes');
    expect(result.notes?.join(' ')).toContain('Cross-site');
  });

  it('flags invalid and malformed values', () => {
    const result = run('Sec-Fetch-Site: elsewhere\nSec-Fetch-Mode: nope\nnot-a-header-line');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Invalid');
  });

  it('recognizes user activation', () => {
    expect(run('Sec-Fetch-User: ?1').stats?.issues).toBe(0);
    expect(run('Sec-Fetch-User: yes').stats?.issues).toBe(1);
  });

  it('handles duplicate headers', () => {
    const result = run('Sec-Fetch-Site: same-origin\nSec-Fetch-Site: cross-site');
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Duplicate');
  });

  it('explains missing fetch metadata on blank or non-header input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
    expect(run('some body text').notes?.join(' ')).toContain('omit');
  });
});
