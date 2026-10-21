import { describe, expect, it } from 'vitest';
import tool, { wrapDataUri } from './image-to-datauri.tool';

type Output = { filename: string; blob: Blob };
type Result = {
  outputs: Output[];
  report?: { output: string; render?: string; language?: string };
  stats?: Record<string, string | number>;
};

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
  const png = () => new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('encodes an image through the merged data-uri tool', async () => {
    const result = (await tool.run({
      files: [png()],
      options: {},
    })) as Result;
    expect(result.report?.output).toContain('data:image/png;base64,');
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo.png.data-uri.txt');
  });

  it('honours the wrapper option', async () => {
    const result = (await tool.run({
      files: [png()],
      options: { wrap: 'html-img' },
    })) as Result;
    expect(result.report?.output.startsWith('<img src="data:image/png;base64,')).toBe(true);
  });
});
