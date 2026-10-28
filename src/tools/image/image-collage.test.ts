import { afterEach, describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { layoutCollage, computeDrawRect } from './image-collage.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('layoutCollage', () => {
  it('arranges 4 images in 2x2 grid', () => {
    const items = [
      { name: 'a', w: 100, h: 100 },
      { name: 'b', w: 100, h: 100 },
      { name: 'c', w: 100, h: 100 },
      { name: 'd', w: 100, h: 100 },
    ];
    const { positions, width, height } = layoutCollage(items, 2, 4);
    expect(positions).toEqual([
      { name: 'a', x: 0, y: 0, w: 100, h: 100 },
      { name: 'b', x: 104, y: 0, w: 100, h: 100 },
      { name: 'c', x: 0, y: 104, w: 100, h: 100 },
      { name: 'd', x: 104, y: 104, w: 100, h: 100 },
    ]);
    expect(width).toBe(204);
    expect(height).toBe(204);
  });

  it('arranges 3 images in single row when columns=3', () => {
    const items = [
      { name: 'a', w: 80, h: 60 },
      { name: 'b', w: 80, h: 60 },
      { name: 'c', w: 80, h: 60 },
    ];
    const { positions, width, height } = layoutCollage(items, 3, 2);
    expect(positions.map((p) => p.x)).toEqual([0, 82, 164]);
    expect(width).toBe(244);
    expect(height).toBe(60);
  });

  it('arranges 5 images in 2 columns with 3 rows', () => {
    const items = [
      { name: '1', w: 100, h: 100 },
      { name: '2', w: 100, h: 100 },
      { name: '3', w: 100, h: 100 },
      { name: '4', w: 100, h: 100 },
      { name: '5', w: 100, h: 100 },
    ];
    const { positions, width, height } = layoutCollage(items, 2, 10);
    expect(positions.map((p) => ({ x: p.x, y: p.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 110, y: 0 },
      { x: 0, y: 110 },
      { x: 110, y: 110 },
      { x: 0, y: 220 },
    ]);
    expect(width).toBe(210);
    expect(height).toBe(320);
  });

  it('auto-columns creates square-ish grid', () => {
    const items = [
      { name: 'a', w: 100, h: 100 },
      { name: 'b', w: 100, h: 100 },
      { name: 'c', w: 100, h: 100 },
    ];
    const { positions, width, height } = layoutCollage(items, 0, 0);
    expect(width).toBe(200);
    expect(height).toBe(200);
  });

  it('handles images with different dimensions by using max cell size', () => {
    const items = [
      { name: 'small', w: 50, h: 50 },
      { name: 'large', w: 200, h: 150 },
    ];
    const { positions, width, height } = layoutCollage(items, 2, 0);
    expect(positions[0]).toEqual({ name: 'small', x: 0, y: 0, w: 50, h: 50 });
    expect(positions[1]).toEqual({ name: 'large', x: 200, y: 0, w: 200, h: 150 });
    expect(width).toBe(400);
    expect(height).toBe(150);
  });

  it('rejects empty items', () => {
    expect(() => layoutCollage([], 0, 0)).toThrow(/Choose at least one image/);
  });

  it('rejects invalid dimensions', () => {
    expect(() => layoutCollage([{ name: 'a', w: 0, h: 100 }], 0, 0)).toThrow(/positive finite dimensions/);
    expect(() => layoutCollage([{ name: 'a', w: -10, h: 100 }], 0, 0)).toThrow(/positive finite dimensions/);
    expect(() => layoutCollage([{ name: 'a', w: NaN, h: 100 }], 0, 0)).toThrow(/positive finite dimensions/);
  });

  it('clamps negative spacing to 0', () => {
    const items = [{ name: 'a', w: 100, h: 100 }, { name: 'b', w: 100, h: 100 }];
    const { width } = layoutCollage(items, 2, -10);
    expect(width).toBe(200);
  });

  it('clamps columns to max 16', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ name: `${i}`, w: 50, h: 50 }));
    const { width } = layoutCollage(items, 100, 0);
    expect(width).toBe(16 * 50 + 15 * 0);
  });
});

describe('computeDrawRect', () => {
  it('fit mode: wider source into square cell letterboxes top/bottom', () => {
    const rect = computeDrawRect(200, 100, 100, 100, 'fit');
    // source is 2:1, cell is 1:1 -> fit to width, center vertically
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(50);
    expect(rect.dy).toBe(25);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0);
    expect(rect.sw).toBe(200);
    expect(rect.sh).toBe(100);
  });

  it('fit mode: taller source into square cell letterboxes left/right', () => {
    const rect = computeDrawRect(100, 200, 100, 100, 'fit');
    expect(rect.dw).toBe(50);
    expect(rect.dh).toBe(100);
    expect(rect.dx).toBe(25);
    expect(rect.dy).toBe(0);
  });

  it('fit mode: same aspect fills cell', () => {
    const rect = computeDrawRect(200, 200, 100, 100, 'fit');
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(100);
    expect(rect.dx).toBe(0);
    expect(rect.dy).toBe(0);
  });

  it('crop mode: wider source into square cell crops sides', () => {
    const rect = computeDrawRect(200, 100, 100, 100, 'crop');
    // source is 2:1, cell is 1:1 -> scale to fill height, crop width
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(100);
    expect(rect.sx).toBe(50); // (200 - 100) / 2
    expect(rect.sw).toBe(100); // cellW / scale = 100 / (100/100) = 100
  });

  it('crop mode: taller source into square cell crops top/bottom', () => {
    const rect = computeDrawRect(100, 200, 100, 100, 'crop');
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(100);
    expect(rect.sy).toBe(50); // (200 - 100) / 2
    expect(rect.sh).toBe(100);
  });

  it('crop mode: same aspect fills cell', () => {
    const rect = computeDrawRect(200, 200, 100, 100, 'crop');
    expect(rect.dw).toBe(100);
    expect(rect.dh).toBe(100);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0);
    expect(rect.sw).toBe(200);
    expect(rect.sh).toBe(200);
  });

  it('fit mode: rectangular cell with wider source', () => {
    const rect = computeDrawRect(400, 200, 300, 200, 'fit');
    // source 2:1, cell 1.5:1 -> fit to width (source wider than cell)
    expect(rect.dw).toBe(300);
    expect(rect.dh).toBe(150); // 200 * (300/400)
    expect(rect.dx).toBe(0);
    expect(rect.dy).toBe(25); // (200 - 150) / 2
  });

  it('crop mode: rectangular cell with taller source', () => {
    const rect = computeDrawRect(200, 400, 300, 200, 'crop');
    // source 1:2, cell 1.5:1 -> scale to fill width, crop height
    expect(rect.dw).toBe(300);
    expect(rect.dh).toBe(200);
    expect(rect.sy).toBeCloseTo(133.33, 1); // (400 - 133.33) / 2
  });
});
describe('image-collage run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = new File([new Uint8Array(10)], 'test.txt', { type: 'text/plain' });
  });

  it('creates a collage from multiple images with default options', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 100, height: 100 },
        { width: 100, height: 100 },
      ],
      colors: [
        [255, 255, 255, 255], // white
        [0, 0, 0, 0], // transparent
      ],
    });

    const files = [makeFile('a.png'), makeFile('b.png')];
    const result = await tool.run({ files, options: {} });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0].filename).toBe('collage.png');
    expect(result.outputs[0].blob.type).toBe('image/png');
    expect(result.stats?.files).toBe(1);
  });
  it('respects columns option', async () => {
    mock = installImageMock({
      dimensions: Array.from({ length: 4 }, () => ({ width: 50, height: 50 })),
    });

    const files = [makeFile('1.png'), makeFile('2.png'), makeFile('3.png'), makeFile('4.png')];
    const result = await tool.run({ files, options: { columns: 4 } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('respects spacing option', async () => {
    mock = installImageMock({
      dimensions: [
        { width: 50, height: 50 },
        { width: 50, height: 50 },
      ],
    });

    const files = [makeFile('a.png'), makeFile('b.png')];
    const result = await tool.run({ files, options: { spacing: 20 } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('uses transparent background when specified', async () => {
    mock = installImageMock({
      dimensions: [{ width: 50, height: 50 }],
    });

    const files = [makeFile('a.png')];
    const result = await tool.run({ files, options: { background: 'transparent' } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('uses custom hex background color', async () => {
    mock = installImageMock({
      bitmaps: [
        { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) },
      ],
    });

    const files = [makeFile('a.png')];
    const result = await tool.run({ files, options: { background: '#ff0000' } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('outputs JPEG when format is jpeg', async () => {
    mock = installImageMock({
      bitmaps: [
        { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) },
      ],
    });

    const files = [makeFile('a.png')];
    const result = await tool.run({ files, options: { format: 'jpeg' } });

    expect(result.outputs[0].filename).toBe('collage.jpg');
    expect(result.outputs[0].blob.type).toBe('image/jpeg');
  });

  it('outputs WebP when format is webp', async () => {
    mock = installImageMock({
      bitmaps: [
        { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) },
      ],
    });

    const files = [makeFile('a.png')];
    const result = await tool.run({ files, options: { format: 'webp' } });

    expect(result.outputs[0].filename).toBe('collage.webp');
    expect(result.outputs[0].blob.type).toBe('image/webp');
  });

  it('uses quality option for JPEG', async () => {
    mock = installImageMock({
      bitmaps: [
        { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) },
      ],
    });

    const files = [makeFile('a.png')];
    const resultLow = await tool.run({ files, options: { format: 'jpeg', quality: 10 } });
    const resultHigh = await tool.run({ files, options: { format: 'jpeg', quality: 100 } });

    // Lower quality should produce smaller file (generally)
    expect(resultLow.outputs[0].blob.size).toBeLessThanOrEqual(resultHigh.outputs[0].blob.size * 2);
  });

  it('uses fit mode by default', async () => {
    mock = installImageMock({
      bitmaps: [
        { width: 200, height: 100, data: new Uint8ClampedArray(200 * 100 * 4).fill(255) },
      ],
    });

    const files = [makeFile('wide.png')];
    const result = await tool.run({ files, options: { aspect: 'fit' } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('uses crop mode when specified', async () => {
    mock = installImageMock({
      dimensions: [{ width: 200, height: 100 }],
    });

    const files = [makeFile('wide.png')];
    const result = await tool.run({ files, options: { aspect: 'crop' } });

    expect(result.outputs[0].blob.type).toBe('image/png');
  });

  it('handles multiple files in batch', async () => {
    mock = installImageMock({
      dimensions: Array.from({ length: 6 }, () => ({ width: 80, height: 60 })),
    });

    const files = Array.from({ length: 6 }, (_, i) => makeFile(`${i}.png`));
    const result = await tool.run({ files, options: { columns: 3 } });

    expect(result.outputs).toHaveLength(1);
    expect(result.stats?.files).toBe(1);
    expect(result.stats?.originalBytes).toBeGreaterThan(0);
  });

  it('rejects invalid background color', async () => {
    mock = installImageMock({
      dimensions: [{ width: 50, height: 50 }],
    });

    const files = [makeFile('a.png')];
    await expect(tool.run({ files, options: { background: 'not-a-color' } })).rejects.toThrow(
      /transparent.*hex colour/,
    );
  });

  it('rejects oversized canvas', async () => {
    mock = installImageMock({
      dimensions: [{ width: 20000, height: 20000 }],
    });

    const files = [makeFile('huge.png', 'image/png', 1000)];
    await expect(tool.run({ files, options: {} })).rejects.toThrow(/too large|exceeds/i);
  });

  it('cancels when signal is aborted', async () => {
    mock = installImageMock({
      dimensions: [{ width: 50, height: 50 }],
    });

    const files = [makeFile('a.png')];
    const controller = new AbortController();
    controller.abort();

    await expect(tool.run({ files, options: {}, signal: controller.signal })).rejects.toThrow(
      /cancelled/i,
    );
  });
});