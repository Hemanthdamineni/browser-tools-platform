import { describe, it, expect } from 'vitest';
import tool from './gitignore.tool';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }).output;

describe('gitignore', () => {
  it('node stack covers dependencies, build output and env files', () => {
    const out = run('', { stack: 'node' });
    expect(out).toContain('node_modules/');
    expect(out).toContain('dist/');
    expect(out).toContain('.env');
  });

  it('python stack covers pycache, pyc and venvs', () => {
    const out = run('', { stack: 'python' });
    expect(out).toContain('__pycache__/');
    expect(out).toContain('*.py[cod]');
    expect(out).toContain('.venv/');
  });

  it('macos stack contains .DS_Store', () => {
    expect(run('', { stack: 'macos' })).toContain('.DS_Store');
  });

  it('always includes the general OS/editor block (except for general)', () => {
    const out = run('', { stack: 'rust' });
    expect(out).toContain('.DS_Store');
    expect(out).toContain('.vscode/*');
    expect(out).toContain('!.vscode/extensions.json');
    expect(run('', { stack: 'general' })).not.toContain('target');
  });

  it('never duplicates a line', () => {
    const out = run('', { stack: 'macos' });
    const lines = out.split('\n').filter(Boolean);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('stack-specific output matches the chosen option', () => {
    expect(run('', { stack: 'go' })).toContain('/bin/');
    expect(run('', { stack: 'java-maven' })).toContain('target/');
  });
});
