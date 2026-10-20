import { describe, expect, it } from 'vitest';
import tool from './json-to-html-table.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-html-table', () => {
  it('renders an array of objects with a header and rows', async () => {
    const r = await run('[ { "name": "Ada", "role": "Admin", "active": true }, { "name": "Lin", "role": "Editor", "active": false } ]');
    expect(r.output).toContain('<table>');
    expect(r.output).toContain('<th>name</th>');
    expect(r.output).toContain('<th>role</th>');
    expect(r.output).toContain('<td>Ada</td>');
    expect(r.output).toContain('<td>Lin</td>');
    expect(r.output).toContain('<td>Admin</td>');
    // booleans preserved as typed values, not as null strings
    expect(r.output).toContain('<td>true</td>');
    expect(r.stats?.rows).toBe(2);
    expect(r.stats?.columns).toBe(3);
  });

  it('uses union of keys across rows as headers', async () => {
    const r = await run('[ { "a": 1 }, { "b": 2, "a": 3 } ]');
    expect(r.output).toContain('<th>a</th>');
    expect(r.output).toContain('<th>b</th>');
    expect(r.output).toContain('<td>1</td>');
    expect(r.output).toContain('<td></td>');
  });

  it('renders an array of arrays using first row as header', async () => {
    const r = await run('[[1, 2, 3], [4, 5, 6], [7, 8, 9]]');
    expect(r.output).toContain('<th>1</th>');
    expect(r.output).toContain('<th>2</th>');
    expect(r.output).toContain('<th>3</th>');
    expect(r.output).toContain('<td>4</td>');
    expect(r.output).toContain('<td>9</td>');
    expect(r.stats?.rows).toBe(2);
  });

  it('numbers columns for a single array row', async () => {
    const r = await run('[[10, 20]]');
    expect(r.output).toContain('<th>1</th>');
    expect(r.output).toContain('<th>2</th>');
  });

  it('escapes text by default and can disable escaping', async () => {
    const src = '[ { "note": "<b>&boom</b>" } ]';
    const escaped = await run(src);
    expect(escaped.output).toContain('&lt;b&gt;&amp;boom&lt;/b&gt;');
    const raw = await run(src, { escape: false });
    expect(raw.output).toContain('<td><b>&boom</b></td>');
  });

  it('pretty-prints nested objects and cells (escaped quotes)', async () => {
    const r = await run('[ { "meta": { "n": 1 }, "tags": ["a", "b"] } ]');
    expect(r.output).toContain('<td>{\n  &quot;n&quot;: 1\n}</td>');
    expect(r.output).toContain('<td>[\n  &quot;a&quot;,\n  &quot;b&quot;\n]</td>');
  });

  it('honours zebra and bordered themes', async () => {
    expect((await run('[{"a":1}]', { theme: 'zebra' })).output).toContain('<table class="zebra">');
    expect((await run('[{"a":1}]', { theme: 'bordered' })).output).toContain('<table class="bordered">');
  });

  it('rejects non-array, empty and invalid json input', async () => {
    await expect(run('{ "a": 1 }')).rejects.toThrow(/array/i);
    await expect(run('[]')).rejects.toThrow(/empty/i);
    await expect(run('nope')).rejects.toThrow(/not valid JSON/i);
    await expect(run('   ')).rejects.toThrow(/Paste a JSON/i);
  });
});
