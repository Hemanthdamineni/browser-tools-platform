import { describe, expect, it } from 'vitest';
import tool from './xml-json-convert.tool';

type Result = { output: string; render?: string; language?: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const parse = (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse(run(text, options).output) as Record<string, unknown>;

describe('xml-json-convert', () => {
  it('maps elements, attributes and text into JSON', () => {
    const data = parse('<book id="1"><title>Dune</title><author>Herbert</author></book>');
    expect(data).toEqual({ book: { '@id': '1', title: 'Dune', author: 'Herbert' } });
  });

  it('collects repeated siblings into arrays and keeps single occurrences scalar', () => {
    const data = parse('<list><item>a</item><item>b</item><item>c</item></list>');
    expect(data).toEqual({ list: { item: ['a', 'b', 'c'] } });
    expect(parse('<list><item>only</item></list>')).toEqual({ list: { item: 'only' } });
  });

  it('decodes entities, CDATA and self-closing tags', () => {
    expect(parse('<a>Tom &amp; Jerry &#65;</a>')).toEqual({ a: 'Tom & Jerry A' });
    expect(parse('<a><![CDATA[<raw> & stuff]]></a>')).toEqual({ a: '<raw> & stuff' });
    expect(parse('<a/>')).toEqual({ a: '' });
    expect(parse('<a id="1"/>')).toEqual({ a: { '@id': '1' } });
  });

  it('skips comments, processing instructions and DOCTYPE', () => {
    const data = parse(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE note SYSTEM "note.dtd">
<!-- a comment -->
<note>
  <to>A</to>
  <!-- inner -->
</note>`);
    expect(data).toEqual({ note: { to: 'A' } });
  });

  it('keeps mixed content in the text key and preserves namespaces', () => {
    expect(parse('<p>Hello <b>world</b>!</p>')).toEqual({ p: { b: 'world', '#text': 'Hello !' } });
    const ns = parse('<ns:root xmlns:ns="urn:x"><ns:child>v</ns:child></ns:root>');
    expect(ns).toEqual({ 'ns:root': { '@xmlns:ns': 'urn:x', 'ns:child': 'v' } });
  });

  it('honours the attributes and textKey options', () => {
    const source = '<book id="1" lang="en"><title>Dune</title></book>';
    expect(parse(source, { attributes: 'nest' })).toEqual({ book: { '@attributes': { id: '1', lang: 'en' }, title: 'Dune' } });
    expect(parse(source, { attributes: 'ignore' })).toEqual({ book: { title: 'Dune' } });
    expect(parse('<a id="1">hi</a>', { textKey: '_text' })).toEqual({ a: { '@id': '1', _text: 'hi' } });
  });

  it('serializes JSON back to indented XML with escaping', () => {
    const result = run(JSON.stringify({ book: { '@id': '1', title: 'Dune', author: 'Herbert' } }), { mode: 'json-to-xml' });
    expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.output).toContain('<book id="1">');
    expect(result.output).toContain('<title>Dune</title>');
    expect(result.filename).toBe('book.xml');
    const escaped = run(JSON.stringify({ a: { b: 'x < y & "z"' } }), { mode: 'json-to-xml' });
    expect(escaped.output).toContain('x &lt; y &amp; "z"');
  });

  it('repeats an element for each array entry', () => {
    const xml = run(JSON.stringify({ list: { item: ['1', '2'] } }), { mode: 'json-to-xml' }).output;
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(parse(xml)).toEqual({ list: { item: ['1', '2'] } });
  });

  it('round-trips XML through JSON and back unchanged', () => {
    const source = '<catalog><book id="1" lang="en"><title>Dune</title><tag>scifi</tag><tag>classic</tag></book><empty/></catalog>';
    const first = run(source).output;
    const back = run(first, { mode: 'json-to-xml' });
    expect(run(back.output).output).toBe(first);
  });

  it('rejects malformed XML and JSON with a clear message', () => {
    expect(() => run('<a><b></a>')).toThrow(/does not match/i);
    expect(() => run('<a>')).toThrow(/never closed/i);
    expect(() => run('<a/><b/>')).toThrow(/only one root element/i);
    expect(() => run('not xml')).toThrow(/not allowed before the root/i);
    expect(() => run('{oops', { mode: 'json-to-xml' })).toThrow(/invalid json/i);
    expect(() => run('{"a":1,"b":2}', { mode: 'json-to-xml' })).toThrow(/exactly one root key/i);
    expect(() => run('{"1bad":{}}', { mode: 'json-to-xml' })).toThrow(/not a valid xml element name/i);
    expect(() => run('<a badname="1"/>')).not.toThrow();
  });

  it('returns guidance when the input is blank', () => {
    const result = run('   ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste an xml document/i);
  });
});
