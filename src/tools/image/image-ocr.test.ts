import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ToolError } from '@/lib/types';
import { meta } from './image-ocr.meta';
import tool from './image-ocr.tool';
import {
  DEFAULT_OCR_LANGUAGE,
  OCR_LANGUAGES,
  OCR_LANGUAGE_CODES,
  OCR_MODES,
  cleanOcrText,
  isSupportedOcrLanguage,
  joinOcrSections,
  ocrLanguageLabel,
  ocrOutputName,
  ocrTextStats,
  resolveOcrLanguage,
  resolveOcrMode,
} from './ocr-languages';
import {
  MAX_OCR_EDGE,
  MAX_OCR_FILE_BYTES,
  MAX_OCR_PIXELS,
  assertOcrFileSize,
  assertOcrImageSize,
  readImageSize,
  sniffImageFormat,
  supportsSimd,
} from './ocr-image';

const VENDOR_DIR = join(process.cwd(), 'public', 'vendor', 'tesseract');

/* ----------------------------- image fixtures ---------------------------- */

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(20);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
}

function gifHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // "GIF89a"
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

function bmpHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x42, 0x4d], 0); // "BM"
  const view = new DataView(bytes.buffer);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  return bytes;
}

function webpHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  const w = width - 1;
  const h = height - 1;
  bytes[24] = w & 0xff;
  bytes[25] = (w >> 8) & 0xff;
  bytes[26] = (w >> 16) & 0xff;
  bytes[27] = h & 0xff;
  bytes[28] = (h >> 8) & 0xff;
  bytes[29] = (h >> 16) & 0xff;
  return bytes;
}

/* --------------------------------- meta ---------------------------------- */

describe('meta', () => {
  it('is a beta image tool that declares on-device, offline processing', () => {
    expect(meta.id).toBe('image-ocr');
    expect(meta.category).toBe('image');
    expect(meta.status).toBe('beta');
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect(meta.description.length).toBeGreaterThan(0);
  });

  it('credits tesseract.js and the tessdata models', () => {
    const names = (meta.credits ?? []).map((c) => c.name);
    expect(names).toContain('tesseract.js');
    expect(names.some((n) => /tessdata/i.test(n))).toBe(true);
    for (const credit of meta.credits ?? []) {
      expect(credit.license).toBe('Apache-2.0');
      expect(credit.url).toMatch(/^https:\/\//);
    }
  });

  it('only lists languages whose models are actually vendored', () => {
    const langDir = join(VENDOR_DIR, 'lang');
    const vendored = readdirSync(langDir)
      .filter((f) => f.endsWith('.traineddata.gz'))
      .map((f) => f.replace('.traineddata.gz', ''))
      .sort();
    expect(vendored).toEqual([...OCR_LANGUAGE_CODES].sort());
    expect(vendored).toContain('eng');
  });

  it('offers exactly the vendored languages in the picker', () => {
    const language = meta.options?.find((o) => o.key === 'language');
    expect(language?.type).toBe('select');
    if (language?.type !== 'select') throw new Error('unreachable');
    expect(language.choices.map((c) => c.value)).toEqual([...OCR_LANGUAGE_CODES]);
    expect(language.default).toBe(DEFAULT_OCR_LANGUAGE);
    expect(language.choices.every((c) => c.label.trim().length > 0)).toBe(true);
  });

  it('offers the text layouts with a Tesseract page segmentation mode each', () => {
    const mode = meta.options?.find((o) => o.key === 'mode');
    expect(mode?.type).toBe('select');
    if (mode?.type !== 'select') throw new Error('unreachable');
    expect(mode.choices.map((c) => c.value)).toEqual(OCR_MODES.map((m) => m.value));
    expect(mode.default).toBe('auto');
  });

  it('ships the engine, the worker script and the language models', () => {
    expect(existsSync(join(VENDOR_DIR, 'worker.min.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'core', 'tesseract-core-simd-lstm.wasm.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'core', 'tesseract-core-lstm.wasm.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'core', 'LICENSE'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'lang', 'NOTICE.txt'))).toBe(true);
  });
});

/* ------------------------------- languages ------------------------------- */

describe('language list', () => {
  it('has unique, non-empty codes and labels', () => {
    expect(OCR_LANGUAGES.length).toBeGreaterThan(0);
    expect(new Set(OCR_LANGUAGE_CODES).size).toBe(OCR_LANGUAGES.length);
    for (const language of OCR_LANGUAGES) {
      expect(language.code).toMatch(/^[a-z]{3}(_[a-z]+)?$/);
      expect(language.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('recognises the supported codes', () => {
    expect(isSupportedOcrLanguage('eng')).toBe(true);
    expect(isSupportedOcrLanguage('deu')).toBe(true);
    expect(isSupportedOcrLanguage('zzz')).toBe(false);
    expect(isSupportedOcrLanguage(undefined)).toBe(false);
    expect(isSupportedOcrLanguage(42)).toBe(false);
  });

  it('falls back to English when no language is given', () => {
    expect(resolveOcrLanguage(undefined)).toBe(DEFAULT_OCR_LANGUAGE);
    expect(resolveOcrLanguage('')).toBe(DEFAULT_OCR_LANGUAGE);
    expect(resolveOcrLanguage('  ')).toBe(DEFAULT_OCR_LANGUAGE);
  });

  it('accepts a supported language, whatever the casing', () => {
    expect(resolveOcrLanguage('deu')).toBe('deu');
    expect(resolveOcrLanguage(' DEU ')).toBe('deu');
  });

  it('refuses a language that is not vendored instead of guessing', () => {
    expect(() => resolveOcrLanguage('jpn')).toThrow(ToolError);
    try {
      resolveOcrLanguage('jpn');
    } catch (err) {
      expect((err as ToolError).message).toContain('jpn');
      expect((err as ToolError).hint).toContain('English');
    }
  });

  it('names a language for messages', () => {
    expect(ocrLanguageLabel('fra')).toBe('French');
    expect(ocrLanguageLabel('xxx')).toBe('xxx');
  });
});

/* --------------------------------- modes --------------------------------- */

describe('text layout', () => {
  it('resolves every offered layout', () => {
    for (const mode of OCR_MODES) {
      expect(resolveOcrMode(mode.value).psm).toBe(mode.psm);
      expect(mode.psm).toMatch(/^\d+$/);
    }
  });

  it('defaults to the automatic layout', () => {
    expect(resolveOcrMode(undefined).value).toBe('auto');
  });

  it('refuses a layout it does not know', () => {
    expect(() => resolveOcrMode('diagonal')).toThrow(ToolError);
  });
});

/* -------------------------------- filenames ------------------------------ */

describe('output filename', () => {
  it('replaces the extension with .txt', () => {
    expect(ocrOutputName('receipt.png')).toBe('receipt.txt');
    expect(ocrOutputName('scan.JPEG')).toBe('scan.txt');
    expect(ocrOutputName('photo.webp')).toBe('photo.txt');
  });

  it('keeps a name that has no extension', () => {
    expect(ocrOutputName('screenshot')).toBe('screenshot.txt');
  });

  it('never returns an empty name', () => {
    expect(ocrOutputName('')).toBe('image.txt');
    expect(ocrOutputName('.png')).toBe('image.txt');
  });

  it('does not let a path escape the download folder', () => {
    expect(ocrOutputName('../../etc/passwd.png')).toBe('.._.._etc_passwd.txt');
    expect(ocrOutputName('a/b.png')).toBe('a_b.txt');
  });
});

/* ------------------------------ text clean-up ---------------------------- */

describe('text clean-up', () => {
  it('removes trailing spaces and tabs', () => {
    expect(cleanOcrText('hello   \nworld\t\t')).toBe('hello\nworld');
  });

  it('normalises Windows and old-Mac line endings', () => {
    expect(cleanOcrText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('collapses runs of blank lines', () => {
    expect(cleanOcrText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('drops leading and trailing blank lines', () => {
    expect(cleanOcrText('\n\n\nhello\n\n\n')).toBe('hello');
  });

  it('turns a form feed into a paragraph break', () => {
    expect(cleanOcrText('page one\fpage two')).toBe('page one\n\npage two');
  });

  it('leaves an empty result empty', () => {
    expect(cleanOcrText('')).toBe('');
    expect(cleanOcrText('   \n  \n')).toBe('');
  });

  it('keeps the spaces inside a line', () => {
    expect(cleanOcrText('a  b   c  ')).toBe('a  b   c');
  });
});

/* --------------------------------- stats --------------------------------- */

describe('text stats', () => {
  it('counts characters, words and lines', () => {
    expect(ocrTextStats('hello world\nsecond line')).toEqual({
      characters: 23,
      words: 4,
      lines: 2,
    });
  });

  it('counts nothing in empty text', () => {
    expect(ocrTextStats('   ')).toEqual({ characters: 3, words: 0, lines: 0 });
  });
});

/* ------------------------------ joined report ---------------------------- */

describe('joined sections', () => {
  it('shows the bare text for a single file', () => {
    expect(joinOcrSections([{ name: 'a.png', text: 'hello' }])).toBe('hello');
  });

  it('names every file in a batch', () => {
    const joined = joinOcrSections([
      { name: 'a.png', text: 'first' },
      { name: 'b.png', text: 'second' },
    ]);
    expect(joined).toContain('a.png');
    expect(joined).toContain('first');
    expect(joined).toContain('b.png');
    expect(joined).toContain('second');
    expect(joined.indexOf('first')).toBeLessThan(joined.indexOf('second'));
  });
});

/* ------------------------------ image headers ---------------------------- */

describe('image sniffing', () => {
  it('recognises the supported formats', () => {
    expect(sniffImageFormat(pngHeader(10, 20))).toBe('png');
    expect(sniffImageFormat(jpegHeader(10, 20))).toBe('jpeg');
    expect(sniffImageFormat(gifHeader(10, 20))).toBe('gif');
    expect(sniffImageFormat(bmpHeader(10, 20))).toBe('bmp');
    expect(sniffImageFormat(webpHeader(10, 20))).toBe('webp');
  });

  it('does not mistake a text file for an image', () => {
    expect(sniffImageFormat(new TextEncoder().encode('this is a text file'))).toBeNull();
    expect(sniffImageFormat(new Uint8Array(0))).toBeNull();
  });
});

describe('image size', () => {
  it('reads the size out of the header of every supported format', () => {
    expect(readImageSize(pngHeader(1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(readImageSize(jpegHeader(800, 600))).toEqual({ width: 800, height: 600 });
    expect(readImageSize(gifHeader(64, 32))).toEqual({ width: 64, height: 32 });
    expect(readImageSize(bmpHeader(300, 200))).toEqual({ width: 300, height: 200 });
    expect(readImageSize(webpHeader(1024, 768))).toEqual({ width: 1024, height: 768 });
  });

  it('returns nothing when the size cannot be found', () => {
    expect(readImageSize(new TextEncoder().encode('not an image'))).toBeNull();
  });

  it('accepts an image inside the limits', () => {
    expect(() => assertOcrImageSize(1920, 1080)).not.toThrow();
    expect(() => assertOcrImageSize(4000, 3000)).not.toThrow();
    // 4000×3000 is 12 MP, well inside the 16 MP budget.
    expect(4000 * 3000).toBeLessThan(MAX_OCR_PIXELS);
  });

  it('refuses an image with too many pixels', () => {
    expect(() => assertOcrImageSize(6000, 6000)).toThrow(ToolError);
    try {
      assertOcrImageSize(6000, 6000);
    } catch (err) {
      expect((err as ToolError).message).toContain('6000×6000');
      expect((err as ToolError).hint).toContain('Resize it first');
    }
  });

  it('refuses an image with one side that is too long', () => {
    expect(() => assertOcrImageSize(MAX_OCR_EDGE + 1, 10)).toThrow(ToolError);
  });

  it('refuses an image with no size at all', () => {
    expect(() => assertOcrImageSize(0, 100)).toThrow(ToolError);
    expect(() => assertOcrImageSize(Number.NaN, 100)).toThrow(ToolError);
  });
});

/* ------------------------------- file limits ----------------------------- */

describe('file size limit', () => {
  it('accepts a file inside the limit', () => {
    expect(() => assertOcrFileSize(1024, 'a.png')).not.toThrow();
  });

  it('refuses a file that is too big, and says which one', () => {
    expect(() => assertOcrFileSize(MAX_OCR_FILE_BYTES + 1, 'huge.png')).toThrow(ToolError);
    try {
      assertOcrFileSize(MAX_OCR_FILE_BYTES + 1, 'huge.png');
    } catch (err) {
      expect((err as ToolError).message).toContain('huge.png');
      expect((err as ToolError).hint).toContain('MB');
    }
  });
});

/* ---------------------------------- SIMD ---------------------------------- */

describe('simd probe', () => {
  it('answers with a boolean', () => {
    expect(typeof supportsSimd()).toBe('boolean');
  });
});

/* ---------------------------------- run ---------------------------------- */

describe('run', () => {
  const run = (files: File[], options: Record<string, string | number | boolean> = {}) =>
    tool.run({ files, options }) as Promise<unknown>;

  it('asks for an image when nothing was chosen', async () => {
    await expect(run([])).rejects.toThrow(ToolError);
    await expect(run([])).rejects.toThrow(/Choose an image/i);
  });

  it('refuses a language it cannot read', async () => {
    const file = new File([pngHeader(10, 10).buffer as ArrayBuffer], 'a.png', {
      type: 'image/png',
    });
    await expect(run([file], { language: 'jpn' })).rejects.toThrow(ToolError);
    await expect(run([file], { language: 'jpn' })).rejects.toThrow(/not a language/i);
  });

  it('refuses a text layout it does not know', async () => {
    const file = new File([pngHeader(10, 10).buffer as ArrayBuffer], 'a.png', {
      type: 'image/png',
    });
    await expect(run([file], { mode: 'diagonal' })).rejects.toThrow(/text layout/i);
  });

  it('refuses a file that is not an image', async () => {
    const file = new File(['hello, this is a text file'], 'notes.txt', { type: 'text/plain' });
    await expect(run([file])).rejects.toThrow(/not a PNG, JPEG, WebP, GIF or BMP image/i);
  });

  it('refuses an image that is too large to decode', async () => {
    const file = new File([pngHeader(6000, 6000).buffer as ArrayBuffer], 'huge.png', {
      type: 'image/png',
    });
    await expect(run([file])).rejects.toThrow(/too large to read/i);
  });
});
