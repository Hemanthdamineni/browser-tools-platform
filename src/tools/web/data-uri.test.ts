import { describe, expect, it } from 'vitest';
import type { FileRunInput } from '@/lib/types';
import tool from './data-uri.tool';
import {
  base64ToBytes,
  bytesToBase64,
  decodeDataUriToText,
  encodeTextToDataUri,
  imageExtension,
  normalizeMode,
  parseDataUri,
  parseImageDataUri,
  wrapDataUri,
} from './data-uri.core';
import { ToolError } from '@/lib/types';

type Output = { filename: string; blob: Blob };
type Result = {
  outputs: Output[];
  report?: { output: string; render?: string; language?: string };
  notes?: string[];
  stats?: Record<string, string | number>;
};

const run = (
  text = '',
  options: Record<string, string | number | boolean> = {},
  files: File[] = [],
): Promise<Result> =>
  tool.run({ text, options, files } as FileRunInput & { text?: string }) as Promise<Result>;

const output = (result: Result): string => result.report?.output ?? '';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

describe('data-uri core', () => {
  it('round-trips bytes through base64', () => {
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(base64ToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('pads base64 correctly for 1 and 2 byte inputs', () => {
    expect(bytesToBase64(new Uint8Array([1]))).toBe('AQ==');
    expect(bytesToBase64(new Uint8Array([1, 2]))).toBe('AQI=');
    expect(base64ToBytes('AQI=')).toEqual(new Uint8Array([1, 2]));
  });

  it('rejects malformed base64 instead of guessing', () => {
    expect(() => base64ToBytes('%%%')).toThrow();
    expect(() => base64ToBytes('AQIDX')).toThrow();
  });

  it('maps legacy mode names onto the merged modes', () => {
    expect(normalizeMode('encode')).toBe('text-encode');
    expect(normalizeMode('decode')).toBe('text-decode');
    expect(normalizeMode('image-encode')).toBe('image-encode');
    expect(() => normalizeMode('nope')).toThrow(ToolError);
  });

  it('splits a data URI into its parts', () => {
    const parsed = parseDataUri('data:text/plain;charset=utf-8;base64,QQ==');
    expect(parsed.mime).toBe('text/plain');
    expect(parsed.parameters).toEqual(['charset=utf-8']);
    expect(parsed.isBase64).toBe(true);
    expect(parsed.payload).toBe('QQ==');
  });

  it('wraps a data URI for CSS and HTML', () => {
    const uri = 'data:image/png;base64,AA==';
    expect(wrapDataUri(uri, 'raw')).toBe(uri);
    expect(wrapDataUri(uri, 'html-img')).toBe(`<img src="${uri}" alt="">`);
    expect(wrapDataUri(uri, 'css-background')).toBe(`background-image: url("${uri}");`);
    expect(wrapDataUri(uri, 'raw', true)).toBe(`/* Embedded image data URI */\n${uri}`);
  });

  it('derives the file extension from an image MIME type', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/svg+xml')).toBe('svg');
    expect(imageExtension('image/png')).toBe('png');
  });
});

describe('data-uri · text → data: URI', () => {
  it('encodes SVG with charset and base64 by default', async () => {
    const result = await run('<svg/>', { mode: 'text-encode', mimeType: 'image/svg+xml' });
    expect(output(result).startsWith('data:image/svg+xml;charset=utf-8;base64,')).toBe(true);
  });

  it('round-trips text through base64', async () => {
    const uri = output(await run('héllo wörld', { mode: 'text-encode', charset: false }));
    const back = output(await run(uri, { mode: 'text-decode' }));
    expect(back).toBe('héllo wörld');
  });

  it('uses percent-encoding when selected', async () => {
    const result = await run('a b&c', { mode: 'text-encode', encoding: 'url' });
    expect(output(result)).toBe(`data:text/plain;charset=utf-8,${encodeURIComponent('a b&c')}`);
  });

  it('keeps the legacy encode/decode mode names working', async () => {
    const uri = output(await run('legacy', { mode: 'encode' }));
    expect(uri.startsWith('data:text/plain')).toBe(true);
    expect(output(await run(uri, { mode: 'decode' }))).toBe('legacy');
  });

  it('reports the size of the produced URI', async () => {
    const result = await run('abc', { mode: 'text-encode' });
    expect(result.stats?.characters).toBe(3);
    expect(Number(result.stats?.uriLength)).toBeGreaterThan(0);
  });

  it('gives empty output for empty input', async () => {
    expect(output(await run('', { mode: 'text-encode' }))).toBe('');
    expect(output(await run('', { mode: 'text-decode' }))).toBe('');
  });
});

describe('data-uri · data: URI → text', () => {
  it('decodes percent-encoded payloads without base64', async () => {
    const result = await run('data:text/plain,hello%20world', { mode: 'text-decode' });
    expect(output(result)).toBe('hello world');
  });

  it('notes binary payloads', async () => {
    const result = await run('data:application/octet-stream;base64,QUJD', { mode: 'text-decode' });
    expect(result.notes?.[0]).toMatch(/binary payload, 3 bytes/);
  });

  it('reports mime and encoding stats when decoding', async () => {
    const result = await run('data:text/plain,hi', { mode: 'text-decode' });
    expect(result.stats?.['MIME type']).toBe('text/plain');
    expect(result.stats?.Encoding).toBe('percent');
    expect(result.stats?.bytes).toBe(2);
  });

  it('throws ToolError on non-data input in decode mode', async () => {
    await expect(run('http://example.com', { mode: 'text-decode' })).rejects.toThrow(ToolError);
    await expect(run('http://example.com', { mode: 'text-decode' })).rejects.toThrow(
      /Not a data: URI/,
    );
  });

  it('throws a helpful error on a malformed payload', async () => {
    await expect(run('data:text/plain;base64,%%%', { mode: 'text-decode' })).rejects.toThrow(
      /could not be decoded/,
    );
    await expect(run('data:text/plain,%E0%A4%A', { mode: 'text-decode' })).rejects.toThrow(
      /could not be decoded/,
    );
  });
});

describe('data-uri · image file → data: URI', () => {
  const png = () => new File([PNG_BYTES], 'photo.png', { type: 'image/png' });

  it('encodes an image and offers the URI for download', async () => {
    const result = await run('', { mode: 'image-encode' }, [png()]);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo.png.data-uri.txt');
    expect(output(result)).toContain('data:image/png;base64,');
    expect(result.stats?.originalBytes).toBe(PNG_BYTES.length);
  });

  it('wraps the URI for HTML and CSS', async () => {
    const html = await run('', { mode: 'image-encode', wrap: 'html-img' }, [png()]);
    expect(output(html)).toMatch(/^<img src="data:image\/png;base64,/);
    const css = await run('', { mode: 'image-encode', wrap: 'css-background' }, [png()]);
    expect(output(css)).toMatch(/^background-image: url\("data:image\/png;base64,/);
  });

  it('rejects an empty selection', async () => {
    await expect(run('', { mode: 'image-encode' }, [])).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects more than one file', async () => {
    await expect(run('', { mode: 'image-encode' }, [png(), png()])).rejects.toThrow(
      /exactly one image file/i,
    );
  });

  it('rejects a file that is not an image', async () => {
    const txt = new File([new Uint8Array([1, 2])], 'notes.txt', { type: 'text/plain' });
    await expect(run('', { mode: 'image-encode' }, [txt])).rejects.toThrow(/not an image/i);
  });
});

describe('data-uri · data: URI → image file', () => {
  const uri = 'data:image/png;base64,AQID';

  it('decodes a pasted data URI into an image file', async () => {
    const result = await run(uri, { mode: 'image-decode' });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('image.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.stats?.bytes).toBe(3);
  });

  it('decodes a data URI held in a text file', async () => {
    const file = new File([uri], 'uri.txt', { type: 'text/plain' });
    const result = await run('', { mode: 'image-decode' }, [file]);
    expect(result.outputs[0]!.filename).toBe('image.png');
  });

  it('rejects an empty selection', async () => {
    await expect(run('', { mode: 'image-decode' }, [])).rejects.toThrow(/Choose one text file/i);
  });

  it('rejects a payload that is not an image data URI', async () => {
    await expect(run('data:text/plain,hello', { mode: 'image-decode' })).rejects.toThrow(
      /valid image data URI/i,
    );
  });
});

describe('encodeTextToDataUri', () => {
  it('falls back to text/plain for an empty MIME type', () => {
    expect(encodeTextToDataUri('hi', { mimeType: '  ', charset: false, encoding: 'base64' })).toBe(
      'data:text/plain;base64,aGk=',
    );
  });
});

describe('decodeDataUriToText', () => {
  it('flags a binary payload', () => {
    const decoded = decodeDataUriToText('data:application/octet-stream;base64,QUJD');
    expect(decoded.binary).toBe(true);
    expect(decoded.bytes).toBe(3);
  });

  it('treats text payloads as textual', () => {
    expect(decodeDataUriToText('data:text/plain,hi').binary).toBe(false);
  });
});

describe('parseImageDataUri', () => {
  it('normalises the MIME casing', () => {
    expect(parseImageDataUri('data:IMAGE/PNG;base64,AQID').mime).toBe('image/png');
  });
});
