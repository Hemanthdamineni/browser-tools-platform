import { describe, expect, it } from 'vitest';
import tool, { parseDataUri } from './datauri-to-image.tool';

type Output = { filename: string; blob: Blob };
type Result = {
  outputs: Output[];
  report?: { output: string };
  stats?: Record<string, string | number>;
};

describe('parseDataUri', () => {
  it('decodes base64 image data and normalizes MIME casing', () => {
    expect(parseDataUri('data:IMAGE/PNG;base64,AQID')).toEqual({
      mime: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
  });
  it('decodes percent-encoded non-base64 payloads', () => {
    expect(parseDataUri('data:image/svg+xml,%3Csvg%3E')).toEqual({
      mime: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg>'),
    });
  });
  it('rejects malformed URIs and payloads', () => {
    expect(() => parseDataUri('https://example.com/a.png')).toThrow(/valid image data URI/i);
    expect(() => parseDataUri('data:image/png;base64,%%%')).toThrow(/payload is malformed/i);
  });
});

describe('datauri-to-image run', () => {
  it('rejects missing text file input', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose one text file/i);
  });

  it('decodes a data URI held in a text file through the merged tool', async () => {
    const file = new File(['data:image/png;base64,AQID'], 'uri.txt', { type: 'text/plain' });
    const result = (await tool.run({ files: [file], options: {} })) as Result;
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('image.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(result.stats?.bytes).toBe(3);
  });
});
