import { describe, it, expect } from 'vitest';
import tool from './code-minify.tool';
import { ToolError } from '@/lib/types';

interface Result {
  output: string;
  render?: string;
  language?: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
}

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Promise<Result>;

const bytes = (text: string) => new TextEncoder().encode(text).length;

describe('code-minify', () => {
  it('returns empty output for blank input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   \n\t ')).output).toBe('');
  });

  it('auto-detects JavaScript and shortens it', async () => {
    const source = 'const a = 1; const b = 2;';
    const result = await run(source);
    expect(result.stats?.language).toBe('JavaScript');
    expect(result.output).toBe('const a=1,b=2;');
    expect(result.output.length).toBeLessThan(source.length);
    expect(result.notes?.some((note) => note.startsWith('Detected JavaScript'))).toBe(true);
  });

  it('minified JavaScript still evaluates to the same value', async () => {
    const source =
      '(() => { const values = [1, 2, 3]; return values.map((n) => n * 2).join(","); })()';
    const { output } = await run(source, { language: 'js' });
    const evaluate = (code: string) => new Function(`return ${code}`)() as string;
    expect(output.length).toBeLessThan(source.length);
    expect(evaluate(output)).toBe(evaluate(source));
    expect(evaluate(output)).toBe('2,4,6');
  });

  it('compress joins declarations when on and keeps them separate when off', async () => {
    const source = 'const a = 1; const b = 2;';
    expect((await run(source, { compress: true, mangle: true })).output).toBe('const a=1,b=2;');
    expect((await run(source, { compress: false, mangle: false })).output).toBe(
      'const a=1;const b=2;',
    );
  });

  it('mangle renames parameters when on and leaves them when off', async () => {
    const source =
      'function add(firstNumber, secondNumber) { /* sum */ return firstNumber + secondNumber; } window.__total = add(20, 22);';
    const mangled = (await run(source, { mangle: true, compress: true })).output;
    const kept = (await run(source, { mangle: false, compress: true })).output;
    expect(mangled).not.toContain('firstNumber');
    expect(kept).toContain('firstNumber');
    expect(kept).toContain('secondNumber');
    expect(mangled.length).toBeLessThan(kept.length);
  });

  it('keeps Unicode string literals exactly', async () => {
    const source = 'const greeting = "héllo 👋 世界"; console.log(greeting);';
    const { output } = await run(source, { language: 'js' });
    expect(output).toContain('héllo 👋 世界');
  });

  it('auto-detects CSS and collapses selectors when restructure is on', async () => {
    const source = '.a { color: #ff0000; } .b, .a { color: red; margin: 0px 0px 0px 0px; }';
    const restructured = await run(source, { restructure: true });
    expect(restructured.stats?.language).toBe('CSS');
    expect(restructured.output).toBe('.a,.b{color:red;margin:0}');

    const plain = await run(source, { restructure: false });
    expect(plain.output).toContain('.b,.a');
    expect(plain.output).toContain('margin:0 0 0 0');
    expect(restructured.output.length).toBeLessThan(plain.output.length);
  });

  it('auto-detects a CSS at-rule snippet', async () => {
    const result = await run('@media (max-width: 600px) {\n  .a { color: #ff0000; }\n}');
    expect(result.stats?.language).toBe('CSS');
    expect(result.output).toBe('@media (max-width:600px){.a{color:red}}');
  });

  it('auto-detects HTML and collapses whitespace when on', async () => {
    const source = '<div class="a">\n  <p>  Hello   world  </p>\n</div>\n';
    const collapsed = await run(source, { collapseWhitespace: true, removeComments: false });
    expect(collapsed.stats?.language).toBe('HTML');
    expect(collapsed.output).toBe('<div class="a"><p>Hello world</p></div>');

    const kept = await run(source, { collapseWhitespace: false, removeComments: false });
    expect(kept.output).toBe(source);
  });

  it('removeComments controls HTML comment removal', async () => {
    const source = '<div>\n  <!-- note -->\n  <p>hello</p>\n</div>';
    const removed = await run(source, { removeComments: true, collapseWhitespace: false });
    expect(removed.output).not.toContain('<!--');
    expect(removed.output).toContain('<p>hello</p>');

    const kept = await run(source, { removeComments: false, collapseWhitespace: false });
    expect(kept.output).toContain('<!-- note -->');
  });

  it('reports input bytes, output bytes and bytes saved', async () => {
    const source = 'function pad(value) {\n  return String(value).padStart(2, "0");\n}\n';
    const result = await run(source, { language: 'js' });
    const inputBytes = bytes(source);
    const outputBytes = bytes(result.output);
    expect(result.stats?.['input bytes']).toBe(inputBytes);
    expect(result.stats?.['output bytes']).toBe(outputBytes);
    expect(result.stats?.['bytes saved']).toBe(inputBytes - outputBytes);
    expect(result.stats?.['percent saved']).toMatch(/^\d+(\.\d+)?%$/);
    expect(outputBytes).toBeLessThan(inputBytes);
  });

  it('flags the output as code with a matching filename', async () => {
    const result = await run('a { color: red; }', { language: 'css' });
    expect(result.render).toBe('code');
    expect(result.language).toBe('css');
    expect(result.filename).toBe('minified.css');
    expect(result.output).toBe('a{color:red}');
  });

  it('an explicit language overrides detection', async () => {
    const result = await run('a { color: red; }', { language: 'css' });
    expect(result.notes?.some((note) => note.startsWith('Detected'))).toBe(false);
  });

  it('throws ToolError for malformed JavaScript', async () => {
    await expect(run('const = ;', { language: 'js' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError for malformed CSS', async () => {
    await expect(run('this is not css', { language: 'css' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError for malformed HTML', async () => {
    await expect(run('<div class="x>text</div>', { language: 'html' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError when auto detection cannot decide', async () => {
    await expect(run('just some words here')).rejects.toThrow(ToolError);
  });
});
