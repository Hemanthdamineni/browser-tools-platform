import { describe, it, expect } from 'vitest';
import tool from './gitignore.tool';

const run = async (text = '', options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })).output;

describe('gitignore', async () => {
  it('node stack covers dependencies, build output and env files', async () => {
    const out = await run('', { stack: 'node' });
    expect(out).toContain('node_modules/');
    expect(out).toContain('dist/');
    expect(out).toContain('.env');
  });

  it('python stack covers pycache, pyc and venvs', async () => {
    const out = await run('', { stack: 'python' });
    expect(out).toContain('__pycache__/');
    expect(out).toContain('*.py[cod]');
    expect(out).toContain('.venv/');
  });

  it('macos stack contains .DS_Store', async () => {
    expect(await run('', { stack: 'macos' })).toContain('.DS_Store');
  });

  it('always includes the general OS/editor block (except for general)', async () => {
    const out = await run('', { stack: 'rust' });
    expect(out).toContain('.DS_Store');
    expect(out).toContain('.vscode/*');
    expect(out).toContain('!.vscode/extensions.json');
    expect(await run('', { stack: 'general' })).not.toContain('target');
  });

  it('never duplicates a line', async () => {
    const out = await run('', { stack: 'macos' });
    const lines = out.split('\n').filter(Boolean);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('stack-specific output matches the chosen option', async () => {
    expect(await run('', { stack: 'go' })).toContain('/bin/');
    expect(await run('', { stack: 'java-maven' })).toContain('target/');
  });
});