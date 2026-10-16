import { describe, it, expect } from 'vitest';
import {
  attr,
  childElements,
  decodeEntities,
  descendants,
  elementText,
  findDescendant,
  firstElement,
  looksLikeOle,
  looksLikeRtf,
  looksLikeZip,
  parseXml,
  resolvePartPath,
  toggleOn,
} from './ooxml';

describe('ooxml.decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a&amp;b&lt;c&gt;d&quot;e&apos;')).toBe('a&b<c>d"e\'');
    expect(decodeEntities('&#65;&#x42;&#x1F600;')).toBe('AB😀');
  });

  it('leaves unknown or malformed entities untouched', () => {
    expect(decodeEntities('&unknown; &amp & x')).toBe('&unknown; &amp & x');
    expect(decodeEntities('no entities')).toBe('no entities');
  });
});

describe('ooxml.parseXml', () => {
  it('parses nested elements, self-closing tags and attributes', () => {
    const root = parseXml('<a><b x="1"/><c d=\'two\'><d>z</d></c></a>');
    const a = firstElement(root, 'a');
    expect(a).toBeTruthy();
    const b = firstElement(a, 'b');
    expect(attr(b, 'x')).toBe('1');
    const c = firstElement(a, 'c');
    expect(attr(c, 'd')).toBe('two');
    expect(elementText(firstElement(c, 'd')!)).toBe('z');
  });

  it('is quote-aware inside attribute values', () => {
    const root = parseXml('<a b="1>2">text</a>');
    expect(attr(firstElement(root, 'a'), 'b')).toBe('1>2');
    expect(elementText(firstElement(root, 'a')!)).toBe('text');
  });

  it('skips comments and processing instructions', () => {
    const root = parseXml('<?xml version="1.0"?><!-- <ignored/> --><r>ok</r>');
    expect(elementText(firstElement(root, 'r')!)).toBe('ok');
  });

  it('keeps CDATA verbatim but decodes normal text', () => {
    const root = parseXml('<r><t><![CDATA[a<b&c]]></t><u>x &amp; y</u></r>');
    const r = firstElement(root, 'r')!;
    expect(elementText(firstElement(r, 't')!)).toBe('a<b&c');
    expect(elementText(firstElement(r, 'u')!)).toBe('x & y');
  });

  it('exposes qualified and local names', () => {
    const root = parseXml('<w:p xmlns:w="urn:w"><w:rPr><w:b w:val="0"/></w:rPr></w:p>');
    const p = firstElement(root, 'p');
    expect(p?.name).toBe('w:p');
    expect(p?.local).toBe('p');
    const b = findDescendant(p as never, 'b');
    expect(toggleOn(b)).toBe(false);
  });

  it('concatenates text in document order', () => {
    const root = parseXml('<r><a>1</a>2<b>3</b>4</r>');
    expect(elementText(firstElement(root, 'r')!)).toBe('1234');
  });

  it('lists direct children and finds descendants', () => {
    const root = parseXml('<r><x>1</x><y><x>2</x></y><x>3</x></r>');
    const r = firstElement(root, 'r')!;
    expect(childElements(r, 'x').map((n) => elementText(n))).toEqual(['1', '3']);
    expect(descendants(r, 'x').map((n) => elementText(n))).toEqual(['1', '2', '3']);
  });

  it('tolerates whitespace between elements', () => {
    const root = parseXml('<r>\n  <a>1</a>\n  <b>2</b>\n</r>');
    const r = firstElement(root, 'r')!;
    expect(childElements(r)).toHaveLength(2);
  });
});

describe('ooxml.resolvePartPath', () => {
  it('resolves relative targets against the base directory', () => {
    expect(resolvePartPath('word', 'media/image1.png')).toBe('word/media/image1.png');
    expect(resolvePartPath('word', '../docProps/core.xml')).toBe('docProps/core.xml');
    expect(resolvePartPath('word', '/word/styles.xml')).toBe('word/styles.xml');
  });

  it('returns external URIs unchanged', () => {
    expect(resolvePartPath('word', 'https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(resolvePartPath('word', '//cdn.example.com/a.png')).toBe('//cdn.example.com/a.png');
  });
});

describe('ooxml signature sniffing', () => {
  it('detects ZIP, OLE and RTF signatures', () => {
    expect(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
    expect(looksLikeZip(new Uint8Array([1, 2, 3, 4]))).toBe(false);
    expect(looksLikeOle(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true);
    expect(looksLikeRtf(new Uint8Array([0x7b, 0x5c, 0x72, 0x74, 0x66]))).toBe(true);
    expect(looksLikeRtf(new Uint8Array([0x7b, 0x5c, 0x78]))).toBe(false);
  });
});
