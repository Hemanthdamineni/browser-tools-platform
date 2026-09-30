import { describe, expect, it } from 'vitest';
import tool, { parseDataUri } from './datauri-to-image.tool';

describe('parseDataUri', () => {
  it('decodes base64 image data and normalizes MIME casing', () => {
    expect(parseDataUri('data:IMAGE/PNG;base64,AQID')).toEqual({ mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) });
  });
  it('decodes percent-encoded non-base64 payloads', () => {
    expect(parseDataUri('data:image/svg+xml,%3Csvg%3E')).toEqual({ mime: 'image/svg+xml', bytes: new TextEncoder().encode('<svg>') });
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
});
