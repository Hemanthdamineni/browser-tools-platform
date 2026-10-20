import { describe, expect, it } from 'vitest';
import tool from './svg-optimizer.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const simple =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n' +
  '  <!-- arrow -->\n' +
  '  <g>\n' +
  '    <path d="M4 4.000 L20 20.000" stroke="#000" stroke-width="1.500000"/>\n' +
  '  </g>\n' +
  '</svg>';

describe('svg-optimizer', () => {
  it('minifies whitespace to a single line', async () => {
    const r = await run(simple);
    expect(r.output).not.toContain('\n');
    expect(r.output).toContain('<svg ');
    expect(r.output).toContain('<path ');
  });

  it('strips comments by default', async () => {
    const r = await run(simple);
    expect(r.output).not.toContain('<!--');
  });

  it('removes empty <g> by default and reports stats', async () => {
    const withEmptyGroup = '<svg viewBox="0 0 2 2"><g></g><rect width="1" height="1"/></svg>';
    const r = await run(withEmptyGroup);
    expect(r.output).not.toContain('<g');
    expect(r.output).toContain('<rect ');
    expect(r.stats?.elements).toBe(2);
    const notes = (r.notes ?? []).join(' ');
    expect(notes).toMatch(/Input \d+ chars → output \d+ chars/);
  });

  it('rounds numeric attributes but never hex colours', async () => {
    const r = await run(simple);
    expect(r.output).toContain('stroke-width="1.5"');
    expect(r.output).toContain('stroke="#000"');
    expect(r.output).not.toContain('1.500000');
  });

  it('pretty mode indents and keeps readability', async () => {
    const r = await run(simple, { mode: 'pretty' });
    expect(r.output).toContain('\n    <path ');
    expect(r.output).toContain('</svg>');
    expect(r.output.startsWith('\n')).toBe(false);
    expect(r.output).toContain('\n  <g');
  });

  it('preserves meaningful text content such as title/label', async () => {
    const withText = '<svg viewBox="0 0 10 10"><title>Hello world</title></svg>';
    const r = await run(withText);
    expect(r.output).toContain('<title>Hello world</title>');
  });

  it('keeps empty groups when the option is off', async () => {
    const withEmptyGroup = '<svg viewBox="0 0 2 2"><g></g><rect width="1" height="1"/></svg>';
    const r = await run(withEmptyGroup, { removeEmptyGroups: false, stripComments: true });
    expect(r.output).toContain('<g>');
    expect(r.output).toContain('</g>');
    expect(r.output).toContain('<rect ');
  });

  it('rejects malformed and non-svg input', async () => {
    await expect(run('<html><body></body></html>')).rejects.toThrow(/svg/i);
    let unbalanced: unknown;
    try {
      await run('<svg><path></svg>');
    } catch (e) {
      unbalanced = e;
    }
    const err = unbalanced as { message?: string; hint?: string };
    expect(err.message).toMatch(/Could not read the SVG/);
    expect((err.hint ?? '').replace(/\n/g, ' ')).toContain('Unbalanced');
    await expect(run('   ')).rejects.toThrow(/SVG/i);
  });

  it('honours precision option', async () => {
    const r = await run('<svg viewBox="0 0 24.567 100"><rect width="2.3456789"/></svg>', {
      precision: 4,
    });
    expect(r.output).toContain('width="2.3457"');
  });

  it('preserves the XML prolog when present', async () => {
    const withProlog =
      '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"></svg>';
    const r = await run(withProlog);
    expect(r.output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(r.output).toContain('<svg');
  });
});
