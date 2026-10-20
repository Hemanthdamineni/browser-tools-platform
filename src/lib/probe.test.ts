import { describe, expect, it } from 'vitest';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import { qrPixels } from './qr-test-helpers';

function decodeMatrix(text: string, utf8: boolean): string | null {
  const lib = qrcode as unknown as {
    stringToBytesFuncs?: Record<string, (s: string) => number[]>;
    stringToBytes?: (s: string) => number[];
  };
  if (utf8 && lib.stringToBytesFuncs?.['UTF-8']) {
    lib.stringToBytes = lib.stringToBytesFuncs['UTF-8'];
  }
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const px = qrPixels(text, 6, 4);
  const res = jsQR(px.data, px.width, px.height, { inversionAttempts: 'attemptBoth' });
  return res?.data ?? null;
}

describe('probe', () => {
  it('ascii', () => {
    expect(decodeMatrix('hello world', false)).toBe('hello world');
  });
  it('unicode default', () => {
    console.log('default:', JSON.stringify(decodeMatrix('héllo', false)));
  });
  it('unicode utf8', () => {
    console.log('utf8:', JSON.stringify(decodeMatrix('héllo', true)));
  });
  it('japanese utf8', () => {
    console.log('jp utf8:', JSON.stringify(decodeMatrix('日本語', true)));
  });
  it('emoji utf8', () => {
    console.log('emoji utf8:', JSON.stringify(decodeMatrix('ok ✅', true)));
  });
});
