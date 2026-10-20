import { describe, it, expect } from 'vitest';
import tool from './pdf-rotate.tool';
import { makePdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-rotate', () => {
  it('rotates the selection cumulatively', async () => {
    const result = await tool.run({
      files: [await makePdf(2)],
      options: { pages: '1', angle: '90' },
    });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
    expect(result.stats).toMatchObject({ pages: 2, rotated: 1 });
  });
  it('rejects invalid angles and out-of-range pages', async () => {
    await expect(
      tool.run({ files: [await makePdf(2)], options: { pages: 'all', angle: '45' } }),
    ).rejects.toThrow(/90, 180/i);
    await expect(
      tool.run({ files: [await makePdf(2)], options: { pages: '7', angle: '90' } }),
    ).rejects.toThrow(/outside/i);
  });
});
