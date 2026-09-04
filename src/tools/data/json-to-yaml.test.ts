import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-yaml.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; language?: string };

describe('json-to-yaml', () => {
  it('converts an object to YAML with a 2-space indent by default', () => {
    expect(run('{ "name": "Toolbench", "tags": ["a", "b"] }').output).toBe(
      'name: Toolbench\ntags:\n  - a\n  - b\n',
    );
  });

  it('honours the 4-space indent branch', () => {
    expect(run('{ "server": { "host": "localhost" } }', { indent: '4' }).output).toBe(
      'server:\n    host: localhost\n',
    );
  });

  it('falls back to 2 spaces for the explicit "2" branch', () => {
    expect(run('{ "a": { "b": 1 } }', { indent: '2' }).output).toBe('a:\n  b: 1\n');
  });

  it('sets a yaml code language', () => {
    expect(run('{ "a": 1 }').language).toBe('yaml');
  });

  it('handles scalars and null', () => {
    expect(run('42').output).toBe('42\n');
    expect(run('null').output).toBe('null\n');
  });

  it('returns empty output for empty input', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
  });

  it('throws ToolError on invalid JSON', () => {
    expect(() => run('{ not: json }')).toThrow(ToolError);
  });
});
