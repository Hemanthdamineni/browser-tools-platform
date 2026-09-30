import { describe, expect, it } from 'vitest';
import tool, { imageOutputType } from './image-convert.tool';

describe('imageOutputType', () => {
  it('returns the canvas MIME type unchanged', () => {
    expect(imageOutputType('image/webp')).toBe('image/webp');
  });
});

describe('image-convert run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
  it('rejects non-image files before browser decoding', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });
  it('rejects image decoding without browser bitmap support', async () => {
    const file = new File(['x'], 'image.png', { type: 'image/png' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow();
  });
});
