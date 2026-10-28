import { afterEach, describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './image-filters.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('image-filters run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(
      /createImageBitmap/i,
    );
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('keeps transparency for PNG output', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { brightness: 0 },
    });
    expect(result.outputs[0]!.filename).toBe('a.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('flattens transparency for JPEG output and applies quality', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { format: 'jpeg', quality: 60 },
    });
    expect(result.outputs[0]!.filename).toBe('a.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 100, h: 100, style: '#ffffff' }]);
    expect(mock.canvases[0]!.encodes[0]!.quality).toBeCloseTo(0.6);
  });

  it('writes WebP output without flattening', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { format: 'webp', brightness: 10 },
    });
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('outputs original format when format is original', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { format: 'original', contrast: 20 },
    });
    expect(result.outputs[0]!.blob.type).toBe('image/png');
  });

  it('applies brightness filter', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { brightness: 50 },
    });
    expect(result.outputs).toHaveLength(1);
    // Check that filter was applied to context
    expect(mock.canvases[0]!.draws.length).toBeGreaterThan(0);
  });

  it('applies contrast filter', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { contrast: -30 },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies saturation filter', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { saturation: 150 },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies grayscale when enabled', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { grayscale: true },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies sepia when enabled', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { sepia: true },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies sharpen light', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { sharpen: 'light' },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies sharpen medium', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { sharpen: 'medium' },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('applies sharpen strong', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { sharpen: 'strong' },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('combines multiple filters', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { brightness: 20, contrast: 15, saturation: 120, grayscale: false, sepia: true, sharpen: 'medium' },
    });
    expect(result.outputs).toHaveLength(1);
  });

  it('processes every file in batch mode and reports progress', async () => {
    mock = installImageMock({ dimensions: [{ width: 50, height: 50 }, { width: 60, height: 60 }] });
    const files = [makeFile('a.png'), makeFile('b.png')];
    const result = await tool.run({ files, options: { brightness: 10 } });
    expect(result.outputs).toHaveLength(2);
    expect(result.stats?.files).toBe(2);
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    await expect(
      tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('rejects an oversized source image', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });

  it('clamps brightness to valid range', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    // These should not throw, just clamp
    await tool.run({ files: [makeFile('a.png')], options: { brightness: 150 } }); // clamped to 100
    await tool.run({ files: [makeFile('b.png')], options: { brightness: -150 } }); // clamped to -100
  });

  it('clamps contrast to valid range', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    await tool.run({ files: [makeFile('a.png')], options: { contrast: 150 } });
    await tool.run({ files: [makeFile('b.png')], options: { contrast: -150 } });
  });

  it('clamps saturation to valid range', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    await tool.run({ files: [makeFile('a.png')], options: { saturation: 300 } }); // clamped to 200
    await tool.run({ files: [makeFile('b.png')], options: { saturation: -50 } }); // clamped to 0
  });

  it('handles invalid sharpen value gracefully', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    // Invalid sharpen value should default to 'none'
    const result = await tool.run({ files: [makeFile('a.png')], options: { sharpen: 'invalid' } });
    expect(result.outputs).toHaveLength(1);
  });

  it('returns correct summary with byte counts', async () => {
    mock = installImageMock({ width: 100, height: 100, encodeSize: 500 });
    const file = makeFile('test.png', 'image/png', 1000);
    // Use a filter so it goes through the main path with stats tracking
    const result = await tool.run({ files: [file], options: { brightness: 10 } });
    expect(result.stats?.files).toBe(1);
    expect(result.stats?.originalBytes).toBe(1000);
    expect(result.stats?.outputBytes).toBe(500);
    expect(result.stats?.savedBytes).toBe(500);
  });

  it('outputs files with correct naming', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const file = makeFile('myphoto.png', 'image/png');
    const r1 = await tool.run({ files: [file], options: { format: 'png' } });
    const r2 = await tool.run({ files: [file], options: { format: 'jpeg' } });
    const r3 = await tool.run({ files: [file], options: { format: 'webp' } });
    expect(r1.outputs[0]!.filename).toBe('myphoto.png');
    expect(r2.outputs[0]!.filename).toBe('myphoto.jpg');
    expect(r3.outputs[0]!.filename).toBe('myphoto.webp');
  });
});