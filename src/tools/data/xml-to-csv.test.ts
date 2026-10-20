import { describe, expect, it } from 'vitest';
import tool from './xml-to-csv.tool';

type Result = { output: string; language?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const CATALOG =
  '<?xml version="1.0"?>\n<catalog>\n  <book id="1"><title>Dune</title><price>9.99</price></book>\n  <book id="2"><title>Neuromancer</title><price>12.50</price></book>\n</catalog>';

describe('xml-to-csv', () => {
  it('auto-detects repeated records and emits attributes as @ columns', async () => {
    const r = await run(CATALOG);
    expect(r.output).toBe(
      ['@id,title,price', '1,Dune,9.99', '2,Neuromancer,12.50'].join('\n'),
    );
    expect(r.stats?.records).toBe(2);
    expect(r.stats?.columns).toBe(3);
    expect(r.language).toBe('csv');
  });

  it('follows a record path and flattens nested elements with dots', async () => {
    const xml =
      '<feed><entry><author><name>Ada</name></author><title>Hello</title></entry><entry><author><name>Bob</name></author><title>World</title></entry></feed>';
    const r = await run(xml, { recordPath: 'feed.entry' });
    expect(r.output).toBe(['author.name,title', 'Ada,Hello', 'Bob,World'].join('\n'));
  });

  it('names the text column after the record element', async () => {
    const xml = '<catalog><book id="1">Dune</book><book id="2">It</book></catalog>';
    const r = await run(xml);
    expect(r.output).toBe(['@id,book', '1,Dune', '2,It'].join('\n'));
  });

  it('can omit attributes and the header row', async () => {
    const r = await run(CATALOG, { includeAttributes: false });
    expect(r.output).toBe(['title,price', 'Dune,9.99', 'Neuromancer,12.50'].join('\n'));
    const noHeader = await run(CATALOG, { header: false, delimiter: 'semicolon' });
    expect(noHeader.output).toBe(['1;Dune;9.99', '2;Neuromancer;12.50'].join('\n'));
  });

  it('serializes repeated child elements as JSON in one cell', async () => {
    const xml = '<root><item><tag>a</tag><tag>b</tag></item><item><tag>c</tag></item></root>';
    const r = await run(xml);
    expect(r.output).toBe(['tag', '"[""a"",""b""]"', 'c'].join('\n'));
  });

  it('decodes entities and preserves CDATA payloads', async () => {
    const xml = '<root><item><n>AT&amp;T</n></item><item><n><![CDATA[<raw>]]></n></item></root>';
    const r = await run(xml);
    expect(r.output).toBe(['n', 'AT&T', '<raw>'].join('\n'));
  });

  it('quotes cells that contain the delimiter, quotes or newlines', async () => {
    const xml = '<root><item><n>a,b</n></item><item><n>say "hi"</n></item></root>';
    const r = await run(xml);
    expect(r.output).toBe(['n', '"a,b"', '"say ""hi"""'].join('\n'));
  });

  it('handles self-closing records and wide row padding', async () => {
    const xml = '<root><item id="1"/><item id="2"><extra>yes</extra></item></root>';
    const r = await run(xml);
    expect(r.output).toBe(['@id,extra', '1,', '2,yes'].join('\n'));
  });

  it('errors on empty input, tag-less input and unmatched paths', async () => {
    await expect(run('   ')).rejects.toThrow(/xml/i);
    await expect(run('just text')).rejects.toThrow(/no xml element/i);
    await expect(run(CATALOG, { recordPath: 'catalog.missing' })).rejects.toThrow(/matched/i);
  });
});
