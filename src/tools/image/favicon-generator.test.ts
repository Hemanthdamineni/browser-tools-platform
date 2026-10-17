import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { ToolError } from '@/lib/types';
import tool, { icoEntries, resizeMath } from './favicon-generator.tool';
import { installImageMock, makeFile, pixelAt, svgFile, type MockHandle } from './image-mock';
import type { OptionValues } from '@/lib/types';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('icoEntries', () => {
  it('writes ICO directory entries and appends image payloads', () => {
    const result = icoEntries([new Uint8Array([10, 11]), new Uint8Array([12])], [16, 32]);
    const view = new DataView(result.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 2,
    ]);
    expect(result[6]).toBe(16);
    expect(result[7]).toBe(16);
    expect(view.getUint16(10, true)).toBe(1); // colour planes
    expect(view.getUint16(12, true)).toBe(32); // bits per pixel
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
  const logo = (name = 'logo.png') => makeFile(name, 'image/png', 500);

  async function runZip(files: File[], options: OptionValues = {}) {
    const result = await tool.run({ files, options });
    const entry = result.outputs[0]!;
    const zip = unzipSync(new Uint8Array(await entry.blob.arrayBuffer()));
    return { result, entry, zip };
  }

  const pixelMock = (over: Partial<Parameters<typeof installImageMock>[0]> = {}) =>
    installImageMock({
      width: 64,
      height: 64,
      color: [255, 0, 0, 255],
      pixelOutput: true,
      ...over,
    });

  it('packages the default icon set into a ZIP with an HTML + manifest report', async () => {
    mock = pixelMock();
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

  it('renders every icon at its declared pixel size in the source colour', async () => {
    mock = pixelMock();
    const { zip } = await runZip([logo()]);
    const icon16 = new Uint8ClampedArray(zip['favicon-16.png']!);
    const icon32 = new Uint8ClampedArray(zip['favicon-32.png']!);
    expect(icon16.length).toBe(16 * 16 * 4);
    expect(icon32.length).toBe(32 * 32 * 4);
    expect(pixelAt(icon16, 16, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(icon16, 16, 15, 15)).toEqual([255, 0, 0, 255]);
  });

  it('embeds a three-entry ICO containing the 16/32/48px PNG payloads', async () => {
    mock = pixelMock();
    const { zip } = await runZip([logo()]);
    const ico = new Uint8Array(zip['favicon.ico']!);
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
    expect(view.getUint16(4, true)).toBe(3);
    const size16 = view.getUint32(14, true);
    const size32 = view.getUint32(30, true);
    const size48 = view.getUint32(46, true);
    expect(size16).toBe(16 * 16 * 4);
    expect(size32).toBe(32 * 32 * 4);
    expect(size48).toBe(48 * 48 * 4);
    // The payloads start after the 6-byte header + three 16-byte entries.
    const offset16 = view.getUint32(18, true);
    const offset32 = view.getUint32(34, true);
    expect(offset16).toBe(6 + 16 * 3);
    expect(offset32).toBe(offset16 + size16);
    expect([...ico.slice(offset16, offset16 + 4)]).toEqual([255, 0, 0, 255]);
  });

  it('omits the 512px favicon but keeps the maskable icon when include512 is false', async () => {
    mock = pixelMock();
    const { result, zip } = await runZip([logo()], { include512: false });
    expect(Object.keys(zip)).not.toContain('favicon-512.png');
    expect(Object.keys(zip)).toContain('icon-maskable-512.png');
    expect(result.stats?.icons).toBe(8);
  });

  it('fills letterbox space with the chosen background colour', async () => {
    mock = pixelMock({ width: 64, height: 32 });
    const { zip } = await runZip([logo()], { background: '#00ff00' });
    const icon = new Uint8ClampedArray(zip['favicon-16.png']!);
    expect(pixelAt(icon, 16, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(icon, 16, 8, 8)).toEqual([255, 0, 0, 255]);
  });

  it('accepts a 3-digit hex background', async () => {
    mock = pixelMock({ width: 64, height: 32 });
    const { zip } = await runZip([logo()], { background: '#0f0' });
    expect(pixelAt(new Uint8ClampedArray(zip['favicon-16.png']!), 16, 0, 0)).toEqual([
      0, 255, 0, 255,
    ]);
  });

  it('leaves letterbox space transparent by default', async () => {
    mock = pixelMock({ width: 64, height: 32 });
    const { zip } = await runZip([logo()]);
    const icon = new Uint8ClampedArray(zip['favicon-16.png']!);
    expect(pixelAt(icon, 16, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('applies maskable padding as a safe-zone border', async () => {
    mock = pixelMock();
    const { zip } = await runZip([logo()], { padding: 10 });
    const maskable = new Uint8ClampedArray(zip['icon-maskable-512.png']!);
    expect(maskable.length).toBe(512 * 512 * 4);
    expect(pixelAt(maskable, 512, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(maskable, 512, 256, 256)).toEqual([255, 0, 0, 255]);
  });

  it('accepts an SVG logo', async () => {
    mock = pixelMock();
    const { result } = await runZip([
      svgFile('logo.svg', '<svg width="32" height="32"><rect width="32" height="32"/></svg>'),
    ]);
    expect(result.outputs).toHaveLength(1);
    expect(result.stats?.icons).toBe(9);
  });

  it('blocks an SVG logo that references an external resource', async () => {
    const file = svgFile(
      'evil.svg',
      '<svg width="32" height="32"><image href="https://evil.example/x.png"/></svg>',
    );
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/external resource/i);
  });

  it('rejects an invalid background colour instead of ignoring it', async () => {
    await expect(
      tool.run({ files: [logo()], options: { background: 'chartreuse' } }),
    ).rejects.toThrow(/hex colour/i);
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
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [logo()], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('rejects a source image that is too large to process safely', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [logo()], options: {} })).rejects.toThrow(ToolError);
    await expect(tool.run({ files: [logo()], options: {} })).rejects.toThrow(/too large/i);
  });

  it('reports a friendly error when the browser cannot encode PNG', async () => {
    mock = installImageMock();
    mock.setBlobType('image/jpeg');
    await expect(tool.run({ files: [logo()], options: {} })).rejects.toThrow(/cannot encode PNG/i);
  });

  it('handles an odd Unicode file name', async () => {
    mock = pixelMock();
    const { entry } = await runZip([logo('ло́го🙂 icon.png')]);
    expect(entry.filename).toBe('favicons.zip');
  });

  it('reports progress and finishes', async () => {
    mock = pixelMock();
    const onProgress = vi.fn();
    await tool.run({ files: [logo()], options: {}, onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
    expect(onProgress.mock.calls.length).toBeGreaterThan(5);
  });

  it('honours an aborted signal', async () => {
    mock = pixelMock();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [logo()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });
});
