import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './html-playground.tool';

function run(parts: { html?: string; css?: string; js?: string } | '') {
  const text = parts === '' ? '' : JSON.stringify(parts);
  return tool.run({ text, options: {} }) as {
    output: string;
    filename?: string;
    stats?: Record<string, number>;
  };
}

describe('html-playground tool', () => {
  it('returns an empty result for empty input', () => {
    const out = run('');
    expect(out.output).toBe('');
    expect(out.filename).toBe('playground.html');
  });

  it('stitches the three parts into one document', () => {
    const out = run({ html: '<p>Hi</p>', css: 'p { color: red; }', js: 'console.log("hi");' });
    expect(out.output).toContain('<body>\n<p>Hi</p>');
    expect(out.output).toContain('<style>\np { color: red; }\n</style>');
    expect(out.output).toContain('<script>\nconsole.log("hi");\n</script>');
    expect(out.stats).toMatchObject({ html: 9, css: 17, js: 18 });
  });

  it('uses the declared defaults when options are omitted', () => {
    const out = tool.run({
      text: JSON.stringify({ html: '<p>a</p>', css: '', js: '' }),
      options: {},
    }) as {
      output: string;
      filename?: string;
    };
    expect(out.filename).toBe('playground.html');
    expect(out.output).toContain('<p>a</p>');
  });

  it('applies the fileName option', () => {
    const out = tool.run({
      text: JSON.stringify({ html: '', css: '', js: '' }),
      options: { fileName: 'demo' },
    }) as { output: string; filename?: string };
    expect(out.filename).toBe('demo.html');
  });

  it('throws a friendly error for non-JSON input', () => {
    expect(() => tool.run({ text: 'not json', options: {} })).toThrow(ToolError);
  });

  it('throws a friendly error for JSON that is not an object', () => {
    expect(() => tool.run({ text: JSON.stringify([1, 2]), options: {} })).toThrow(ToolError);
  });
});
