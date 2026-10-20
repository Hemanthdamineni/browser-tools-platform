import { describe, expect, it } from 'vitest';
import tool from './conventional-commit.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('conventional-commit', () => {
  it('builds a feat with scope', async () => {
    const r = await run('Add pagination to the list endpoint', { type: 'feat', scope: 'api' });
    expect(r.output).toBe('feat(api): Add pagination to the list endpoint\n');
    expect(r.stats?.subjectLength).toBe('feat(api): Add pagination to the list endpoint'.length);
  });

  it('marks breaking changes with ! and a footer', async () => {
    const r = await run('Drop v1 routes', {
      type: 'feat',
      scope: 'api',
      breaking: true,
      breakingDetail: 'v1 endpoints removed',
    });
    expect(r.output).toContain('feat(api)!: Drop v1 routes');
    expect(r.output).toContain('BREAKING CHANGE: v1 endpoints removed');
    expect(r.stats?.breaking).toBe(1);
  });

  it('uses subject as the BREAKING CHANGE footer when no detail is given', async () => {
    const r = await run('Reject old tokens', { type: 'fix', breaking: true });
    expect(r.output).toContain('BREAKING CHANGE: Reject old tokens');
  });

  it('appends body after the subject', async () => {
    const r = await run('Improve startup time', {
      type: 'perf',
      body: 'Cache the config parse step.',
    });
    expect(r.output).toBe('perf: Improve startup time\n\nCache the config parse step.\n');
  });

  it('warns when the subject is too long', async () => {
    const long =
      'This is an extremely long subject line that definitely goes way beyond the seventy two character suggestion';
    const r = await run(long, { type: 'docs' });
    expect((r.notes ?? []).join(' ')).toMatch(/over the suggested/i);
  });

  it('ignores extra lines and uses the first non-empty line as subject', async () => {
    const r = await run('\nfeat subject here\nmore text\n', { type: 'fix' });
    expect(r.output).toBe('fix: feat subject here\n');
    expect((r.notes ?? []).join(' ')).toMatch(/ignored 1 extra line/i);
  });

  it('rejects empty subjects', async () => {
    await expect(run('   \n\n', { type: 'chore' })).rejects.toThrow(/describe the change/i);
  });
});
