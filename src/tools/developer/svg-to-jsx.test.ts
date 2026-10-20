import { describe, expect, it } from 'vitest';
import tool from './svg-to-jsx.tool';

type Result = { output: string; language?: string; render?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const ICON =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">\n  <path d="M4 4h16v16H4z" stroke-width="2" class="icon"/>\n</svg>';

describe('svg-to-jsx', () => {
  it('camelCases attributes and self-closes empty elements', async () => {
    const r = await run(ICON, { component: false });
    expect(r.output).toBe(
      [
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">',
        '  <path d="M4 4h16v16H4z" strokeWidth="2" className="icon" />',
        '</svg>',
      ].join('\n'),
    );
    expect(r.language).toBe('jsx');
  });

  it('wraps output in a typed component with a props spread', async () => {
    const r = await run(ICON, { component: true, typescript: true, componentName: 'ArrowIcon' });
    const lines = r.output.split('\n');
    expect(lines[0]).toBe("import type { SVGProps } from 'react';");
    expect(lines[2]).toBe('export function ArrowIcon(props: SVGProps<SVGSVGElement>) {');
    expect(lines[3]).toBe('  return (');
    expect(lines[4]).toBe('    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>');
    expect(lines[5]).toBe('      <path d="M4 4h16v16H4z" strokeWidth="2" className="icon" />');
    expect(lines[7]).toBe('  );');
    expect(r.language).toBe('tsx');
  });

  it('omits the import and type annotation without TypeScript', async () => {
    const r = await run(ICON, { component: true, typescript: false });
    expect(r.output).not.toContain('SVGProps');
    expect(r.output).toContain('export function Icon(props) {');
  });

  it('converts style strings to style objects with quoted values', async () => {
    const r = await run('<circle cx="5" cy="5" r="4" style="fill: red; stroke-width: 2;"/>', {
      component: false,
    });
    expect(r.output).toBe(
      "<circle cx=\"5\" cy=\"5\" r=\"4\" style={{fill: 'red', strokeWidth: '2'}} />",
    );
  });

  it('keeps style strings when the option is off', async () => {
    const r = await run('<circle r="4" style="fill: red; stroke-width: 2;"/>', {
      component: false,
      styleObjects: false,
    });
    expect(r.output).toBe('<circle r="4" style="fill: red; stroke-width: 2;" />');
  });

  it('turns comments into JSX comments', async () => {
    const r = await run('<svg><!-- dot --><circle r="1"/></svg>', { component: false });
    expect(r.output.split('\n')).toEqual([
      '<svg>',
      '  {/* dot */}',
      '  <circle r="1" />',
      '</svg>',
    ]);
  });

  it('keeps data and aria attributes untouched and preserves viewBox case', async () => {
    const r = await run('<svg viewBox="0 0 1 1" data-testid="x" aria-label="dot"/>', {
      component: false,
    });
    expect(r.output).toBe('<svg viewBox="0 0 1 1" data-testid="x" aria-label="dot" />');
  });

  it('maps namespace attributes', async () => {
    const r = await run('<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>', {
      component: false,
    });
    expect(r.output).toContain('xmlnsXlink="http://www.w3.org/1999/xlink"');
    expect(r.output).toContain('<use xlinkHref="#a" />');
  });

  it('keeps single-text elements on one line and escapes braces', async () => {
    const r = await run('<text x="1">Hello {world}</text>', { component: false });
    expect(r.output).toBe("<text x=\"1\">Hello {'{'}world{'}'}</text>");
  });

  it('emits style/script content as a template literal child', async () => {
    const r = await run('<svg><style>.a{fill:red}</style><circle class="a"/></svg>', {
      component: false,
    });
    expect(r.output).toContain('<style>{`');
    expect(r.output).toContain('.a{fill:red}');
    expect(r.output).toContain('<circle className="a" />');
  });

  it('sanitizes the component name to PascalCase', async () => {
    const r = await run(ICON, { component: true, componentName: 'arrow icon' });
    expect(r.output).toContain('export function ArrowIcon(props');
    const fallback = await run(ICON, { component: true, componentName: '!!!' });
    expect(fallback.output).toContain('export function Icon(props');
  });

  it('reports stats and rejects empty input', async () => {
    const r = await run(ICON, { component: false });
    expect(r.stats?.elements).toBe(2);
    expect(r.stats?.attributes).toBeGreaterThanOrEqual(5);
    await expect(run('   ')).rejects.toThrow(/svg|markup/i);
  });
});
