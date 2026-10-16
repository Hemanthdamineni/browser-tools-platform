import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import tool, { icoEntries, resizeMath } from './favicon-generator.tool';
import {
  imageFile,
  installFakeImageEnv,
  pixelAt,
  resetFakeImageEnv,
  setFakeBlobType,
  solidImage,
} from './test-canvas';
import type { OptionValues } from '@/lib/types';

describe('icoEntries', () => {
  it('writes ICO directory entries and appends image payloads', () => {
    const result = icoEntries([new Uint8Array([10, 11]), new Uint8Array([12])], [16, 32]);
    const view = new DataView(result.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 2,
    ]);
    expect(result[6]).toBe(16);
    expect(view.getUint32(14, true)).toBe(2); // first entry payload size
    expect(view.getUint32(18, true)).toBe(38); // first entry payload offset
    expect(view.getUint32(30, true)).toBe(1); // second entry payload size
    expect(view.getUint32(34, true)).toBe(40); // second entry payload offset
    expect([...result.slice(38)]).toEqual([10, 11, 12]);
  });
});

describe('resizeMath', () => {
  it('fits a landscape image inside the icon bounds and centers it', () => {
    expect(resizeMath(200, 100, 100, 0)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
  });
  it('applies inner padding while preserving aspect ratio', () => {
    expect(resizeMath(100, 100, 100, 10)).toEqual({ x: 10, y: 10, w: 80, h: 80 });
  });
  it('clamps out-of-range padding and treats malformed values as none', () => {
    expect(resizeMath(100, 100, 100, 60)).toEqual(resizeMath(100, 100, 100, 45));
    expect(resizeMath(100, 100, 100, Number.NaN)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it('never produces a zero-sized draw rect for extreme aspect ratios', () => {
    expect(resizeMath(10_000, 1, 16, 0)).toEqual({ x: 0, y: 8, w: 16, h: 1 });
  });
});

describe('favicon-generator run', () => {
  beforeEach(() => installFakeImageEnv());
  afterEach(() => resetFakeImageEnv());

  const logo = (w = 64, h = 64) => imageFile('logo.png', solidImage(w, h, [255, 0, 0, 255]));

  async function runZip(files: File[], options: OptionValues = {}) {
    const result = await tool.run({ files, options });
    const entry = result.outputs[0]!;
    const zip = unzipSync(new Uint8Array(await entry.blob.arrayBuffer()));
    return { result, entry, zip };
  }

  it('packages the default icon set into a ZIP with an HTML + manifest report', async () => {
    const { result, entry, zip } = await runZip([logo()]);
    expect(entry.filename).toBe('favicons.zip');
    expect(entry.blob.type).toBe('application/zip');
    expect(Object.keys(zip).sort()).toEqual(
      [
        'apple-touch-icon.png',
        'favicon-16.png',
        'favicon-180.png',
        'favicon-192.png',
        'favicon-32.png',
        'favicon-48.png',
        'favicon-512.png',
        'favicon.ico',
        'icon-maskable-512.png',
      ].sort(),
    );
    expect(result.report?.render).toBe('code');
    expect(result.report?.language).toBe('html');
    expect(result.report?.output).toContain('<link rel="icon" href="/favicon.ico"');
    expect(result.report?.output).toContain('href="/favicon-192.png"');
    expect(result.report?.output).toContain('site.webmanifest');
    expect(result.report?.output).toContain('"sizes": "512x512"');
    expect(result.report?.output).toContain('"purpose": "maskable"');
    expect(result.stats?.icons).toBe(9);
  });

  it('omits the 512px favicon but keeps the maskable icon when include512 is false', async () => {
    const { result, zip } = await runZip([logo()], { include512: false });
    expect(Object.keys(zip)).not.toContain('favicon-512.png');
    expect(Object.keys(zip)).toContain('icon-maskable-512.png');
    expect(result.stats?.icons).toBe(8);
  });

  it('fills letterbox space with the chosen background colour', async () => {
    const { zip } = await runZip([logo(64, 32)], { background: '#00ff00' });
    const icon = new Uint8ClampedArray(zip['favicon-16.png']!);
    expect(pixelAt(icon, 16, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(icon, 16, 8, 8)).toEqual([255, 0, 0, 255]);
  });

  it('leaves letterbox space transparent by default', async () => {
    const { zip } = await runZip([logo(64, 32)]);
    const icon = new Uint8ClampedArray(zip['favicon-16.png']!);
    expect(pixelAt(icon, 16, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('applies maskable padding as a safe-zone border', async () => {
    const { zip } = await runZip([logo()], { padding: 10 });
    const maskable = new Uint8ClampedArray(zip['icon-maskable-512.png']!);
    expect(maskable.length).toBe(512 * 512 * 4);
    expect(pixelAt(maskable, 512, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(maskable, 512, 256, 256)).toEqual([255, 0, 0, 255]);
  });

  it('rejects empty and multiple selections', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
    await expect(tool.run({ files: [logo(), logo()], options: {} })).rejects.toThrow(
      /exactly one image file/i,
    );
  });

  it('rejects non-image input', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects files that cannot be decoded', async () => {
    const file = new File(['broken'], 'broken.png', { type: 'image/png' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('reports a friendly error when the browser cannot encode PNG', async () => {
    setFakeBlobType('image/jpeg');
    await expect(tool.run({ files: [logo()], options: {} })).rejects.toThrow(/encode PNG/i);
  });

  it('honours an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [logo()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
