import { describe, it } from 'vitest';
import tool from '@/tools/image/image-collage.tool';
import { installImageMock, makeFile, blobPixels, pixelAt } from '@/tools/image/image-mock';
import { parseOrder } from '@/tools/image/image-collage.core';

describe('probe order', () => {
  it('checks parseOrder with order option', async () => {
    console.log('parseOrder("1,0",2):', parseOrder('1,0', 2));
    const mock = installImageMock({
      dimensions: [
        { width: 2, height: 2 },
        { width: 2, height: 2 },
      ],
      colors: [
        [255, 0, 0, 255],
        [0, 0, 255, 255],
      ],
      pixelOutput: true,
    });
    const run = (order: string) =>
      tool.run({ files: [makeFile('a.png'), makeFile('b.png')], options: { columns: '1', spacing: 0, order } });
    const swapped = await run('1,0');
    const canvas = mock.canvases.at(-1)!;
    console.log('draw calls:', JSON.stringify(canvas.draws.map((d) => d.args.slice(1))));
    const px = await blobPixels(swapped.outputs[0]!.blob);
    console.log('buf len:', px.length, 'canvas:', canvas.width, canvas.height);
    console.log('pixel(0,0):', pixelAt(px, 2, 0, 0), 'pixel(0,2):', pixelAt(px, 2, 0, 2));
    // try reading via canvas pixels directly
    console.log('canvas pixel(0,0):', Array.from(canvas.pixels.slice(0, 4)), 'canvas pixel(0,2):', Array.from(canvas.pixels.slice(16, 20)));
    mock.restore();
  });
});
