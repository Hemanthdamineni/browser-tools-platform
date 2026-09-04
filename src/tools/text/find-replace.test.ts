import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './find-replace.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('find-replace', () => {
  it('plain mode replaces every occurrence', () => {
    const r = run('the cat sat on the mat', { find: 'the', replace: 'a' });
    expect(r.output).toBe('a cat sat on a mat');
    expect(r.stats?.['replacements made']).toBe(2);
  });

  it('plain mode treats $ in the replacement literally', () => {
    expect(run('price x', { find: 'x', replace: '$1' }).output).toBe('price $1');
  });

  it('whole-word mode only matches full words', () => {
    const r = run('cat category catalog cat', { find: 'cat', replace: 'dog', mode: 'whole-word' });
    expect(r.output).toBe('dog category catalog dog');
    expect(r.stats?.['replacements made']).toBe(2);
  });

  it('regex mode supports $1 backreferences', () => {
    const r = run('Jane Doe', {
      find: '(\\w+) (\\w+)',
      replace: '$2, $1',
      mode: 'regex',
      flags: 'g',
    });
    expect(r.output).toBe('Doe, Jane');
    expect(r.stats?.['replacements made']).toBe(1);
  });

  it('regex mode without the g flag replaces only the first match', () => {
    const r = run('aaa', { find: 'a', replace: 'b', mode: 'regex', flags: '' });
    expect(r.output).toBe('baa');
    expect(r.stats?.['replacements made']).toBe(1);
  });

  it('caseInsensitive folds case in plain mode', () => {
    const r = run('The THE the', { find: 'the', replace: 'x', caseInsensitive: true });
    expect(r.output).toBe('x x x');
    expect(r.stats?.['replacements made']).toBe(3);
  });

  it('caseInsensitive adds the i flag in regex mode', () => {
    expect(
      run('Foo foo', { find: 'foo', replace: 'bar', mode: 'regex', caseInsensitive: true }).output,
    ).toBe('bar bar');
  });

  it('empty find throws ToolError', () => {
    expect(() => run('hello', { find: '' })).toThrow(ToolError);
  });

  it('invalid regex pattern throws ToolError', () => {
    expect(() => run('hello', { find: '(', mode: 'regex' })).toThrow(ToolError);
  });

  it('invalid regex flags throw ToolError', () => {
    expect(() => run('hello', { find: 'h', mode: 'regex', flags: 'zz' })).toThrow(ToolError);
  });

  it('empty input returns empty output', () => {
    expect(run('', { find: 'a', replace: 'b' }).output).toBe('');
  });
});
