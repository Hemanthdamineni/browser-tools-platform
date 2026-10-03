import { describe, expect, it } from 'vitest';
import tool, { wrapDataUri } from './image-to-datauri.tool';

describe('wrapDataUri', () => {
  const uri = 'data:image/png;base64,AA==';
  it('returns the URI, HTML image, and CSS background forms', () => {
    expect(wrapDataUri(uri, 'raw')).toBe(uri);
    expect(wrapDataUri(uri, 'html-img')).toBe(`<img src="${uri}" alt="">`);
    expect(wrapDataUri(uri, 'css-background')).toBe(`background-image: url("${uri}");`);
  });
  it('can prepend the explanatory comment', () => {
    expect(wrapDataUri(uri, 'raw', true)).toBe(`/* Embedded image data URI */\n${uri}`);
  });
});

describe('image-to-datauri run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
});
