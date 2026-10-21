import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTypedSignature, signatureStyle, SIGNATURE_STYLES } from './typed';
import { decodeDataUrl, readPngInfo } from './pixels';
import { installCanvasMock, type CanvasMockHandle } from '../../../test/signature-fakes';

let mock: CanvasMockHandle;

beforeEach(() => {
  mock = installCanvasMock();
});

afterEach(() => {
  mock.restore();
});

describe('signatureStyle', () => {
  it('falls back to the first style for unknown values', () => {
    expect(signatureStyle('script').value).toBe('script');
    expect(signatureStyle('nonsense').value).toBe(SIGNATURE_STYLES[0]!.value);
    expect(signatureStyle(undefined).value).toBe(SIGNATURE_STYLES[0]!.value);
  });

  it('only uses generic font families (no webfonts are fetched)', () => {
    for (const style of SIGNATURE_STYLES) {
      expect(style.font).toMatch(/serif|sans-serif|monospace|cursive/);
      expect(style.font).not.toMatch(/url\(|@import/);
    }
  });
});

describe('renderTypedSignature', () => {
  it('renders a name into a transparent PNG', () => {
    const asset = renderTypedSignature({ text: 'Ada Lovelace', style: 'classic' });
    expect(asset.mode).toBe('type');
    expect(asset.hasAlpha).toBe(true);
    expect(asset.dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const info = readPngInfo(decodeDataUrl(asset.dataUrl).bytes);
    expect(info).not.toBeNull();
    // 12 characters at half the font size each, one font size tall.
    expect(asset.width / asset.height).toBeCloseTo(6, 1);
    expect(info!.width).toBe(asset.width);
    expect(info!.height).toBe(asset.height);
  });

  it('uses the requested ink colour', () => {
    const asset = renderTypedSignature({ text: 'A', color: '#b91c1c' });
    const cropped = mock.canvases[mock.canvases.length - 1]!;
    const pixel = cropped.pixels;
    expect(pixel[0]).toBe(0xb9);
    expect(pixel[1]).toBe(0x1c);
    expect(pixel[2]).toBe(0x1c);
    expect(pixel[3]).toBe(255);
    expect(asset.width).toBeGreaterThan(0);
  });

  it('handles Unicode names', () => {
    const asset = renderTypedSignature({ text: 'Ünïcödé 日本語 ✍' });
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
  });

  it('refuses an empty name', () => {
    expect(() => renderTypedSignature({ text: '   ' })).toThrow(/Type a name/);
  });
});
