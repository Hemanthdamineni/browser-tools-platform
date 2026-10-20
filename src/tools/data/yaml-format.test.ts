import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './yaml-format.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    language?: string;
    warnings?: string[];
    stats?: Record<string, string | number>;
  };

describe('yaml-format', () => {
  it('formats flow collections with two-space indentation by default', async () => {
    expect((await run('service:\n    enabled: true\n    ports: [8080,8081]\n')).output).toBe(
      'service:\n  enabled: true\n  ports: [ 8080, 8081 ]\n',
    );
  });

  it('supports four-space indentation', async () => {
    expect((await run('service:\n  enabled: true\n', { indent: '4' })).output).toBe(
      'service:\n    enabled: true\n',
    );
  });

  it('preserves comments and anchors', async () => {
    const result = await run(
      '# config\ndefaults: &defaults\n  retries: 3\nservice:\n  <<: *defaults\n',
    );
    expect(result.output).toContain('# config');
    expect(result.output).toContain('&defaults');
    expect(result.output).toContain('*defaults');
  });

  it('preserves multi-document streams and reports their count', async () => {
    const result = await run('---\nname: first\n---\nname: second\n');
    expect(result.output).toBe('---\nname: first\n---\nname: second\n');
    expect(result.stats?.documents).toBe(2);
  });

  it('preserves comment-only input', async () => {
    expect((await run('# only a comment')).output).toBe('# only a comment\n');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('  \n')).output).toBe('');
  });

  it('sets the YAML language', async () => {
    expect((await run('answer: 42')).language).toBe('yaml');
  });

  it('throws a user-facing error for malformed YAML and duplicate keys', async () => {
    await expect(run('key: [unterminated')).rejects.toBeInstanceOf(ToolError);
    await expect(run('key: 1\nkey: 2')).rejects.toBeInstanceOf(ToolError);
  });
});
