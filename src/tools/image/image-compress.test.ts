import { describe, expect, it } from 'vitest';
import tool from './image-compress.tool';

describe('image-compress run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
  it('rejects a non-image selection', async () => {
    const file = new File(['not image'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });
  it('rejects image decoding when createImageBitmap is unavailable', async () => {
    const file = new File(['x'], 'image.png', { type: 'image/png' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow();
  });
});
