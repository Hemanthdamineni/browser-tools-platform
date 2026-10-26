import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getContent } from '@/lib/content';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ToolError } from '@/lib/types';
import { getTool } from '@/lib/registry';
import { meta } from './pdf-ocr.meta';
import tool from './pdf-ocr.tool';
import { OCR_LANGUAGE_CODES } from '@/tools/image/ocr-languages';

const VENDOR_DIR = join(process.cwd(), 'public', 'vendor', 'tesseract');

/* -------------------------------------------------------------------------- */
/*  pdf.js is mocked: the real renderer needs a worker and a raster surface.   */
/* -------------------------------------------------------------------------- */

const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: getDocumentMock,
}));

/** A pdf.js document stand-in with the parts the tool touches. */
function fakeDocument(numPages = 2) {
  return { numPages, destroy: vi.fn(async () => undefined) };
}

function run(files: File[], options: Record<string, string | number | boolean> = {}) {
  return tool.run({ files, options }) as Promise<unknown>;
}

/** A file that the tool accepts as a PDF (pdf.js itself is mocked). */
function pdfFile(name = 'scan.pdf'): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n')], name, { type: 'application/pdf' });
}

beforeEach(() => {
  getDocumentMock.mockReset();
  getDocumentMock.mockReturnValue({ promise: Promise.resolve(fakeDocument()) });
});

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

describe('meta', () => {
  it('is a beta PDF tool that declares on-device, offline processing', () => {
    expect(meta.id).toBe('pdf-ocr');
    expect(meta.category).toBe('pdf');
    expect(meta.status).toBe('beta');
    expect(meta.input).toBe('file');
    expect(meta.accept).toBe('application/pdf');
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect(meta.description.length).toBeGreaterThan(0);
  });

  it('runs on the main thread because Tesseract brings its own worker', () => {
    expect(meta.worker).toBe(false);
  });

  it('opts into the dedicated OCR panel', () => {
    expect(meta.panel).toBe('pdf-ocr');
  });

  it('ships real examples and enough questions', () => {
    expect((meta.examples ?? []).length).toBeGreaterThanOrEqual(3);
    expect((getContent(meta.id)?.faq ?? []).length).toBeGreaterThanOrEqual(3);
    expect((meta.keywords ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('credits the renderer, the PDF library and the OCR stack', () => {
    const names = (meta.credits ?? []).map((credit) => credit.name);
    expect(names).toContain('pdf-lib');
    expect(names).toContain('pdfjs-dist');
    expect(names).toContain('tesseract.js');
    expect(names.some((name) => /tessdata/i.test(name))).toBe(true);
    for (const credit of meta.credits ?? []) {
      expect(credit.url).toMatch(/^https:\/\//);
      expect(credit.license.length).toBeGreaterThan(0);
    }
  });

  it('offers exactly the languages whose models are vendored', () => {
    const language = meta.options?.find((option) => option.key === 'language');
    expect(language?.type).toBe('select');
    if (language?.type !== 'select') throw new Error('unreachable');
    expect(language.choices.map((choice) => choice.value)).toEqual([...OCR_LANGUAGE_CODES]);
    expect(language.default).toBe('eng');

    const vendored = readdirSync(join(VENDOR_DIR, 'lang'))
      .filter((file) => file.endsWith('.traineddata.gz'))
      .map((file) => file.replace('.traineddata.gz', ''))
      .sort();
    expect(vendored).toEqual([...OCR_LANGUAGE_CODES].sort());
  });

  it('ships the OCR engine, the worker script and the language models', () => {
    expect(existsSync(join(VENDOR_DIR, 'worker.min.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'core', 'tesseract-core-simd-lstm.wasm.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'core', 'tesseract-core-lstm.wasm.js'))).toBe(true);
    expect(existsSync(join(VENDOR_DIR, 'lang', 'NOTICE.txt'))).toBe(true);
  });

  it('ships the required examples, FAQ entries and article', () => {
    expect((meta.examples ?? []).length).toBeGreaterThanOrEqual(3);
    expect((getContent(meta.id)?.faq ?? []).length).toBeGreaterThanOrEqual(3);
    const article = getContent(meta.id)?.article ?? [];
    expect(article.length).toBeGreaterThanOrEqual(3);
    expect(article.length).toBeLessThanOrEqual(5);
    for (const section of article) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(0);
    }
    expect((meta.related ?? []).length).toBeGreaterThanOrEqual(2);
    for (const related of meta.related ?? []) {
      expect(getTool(related)?.meta.hidden, `${related} should be a visible tool`).not.toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  run — the errors a visitor can actually hit                                */
/* -------------------------------------------------------------------------- */

describe('run', () => {
  it('asks for a PDF when nothing was chosen', async () => {
    await expect(run([])).rejects.toThrow(ToolError);
    await expect(run([])).rejects.toThrow(/Choose a PDF file/i);
  });

  it('refuses a file that is not a valid PDF', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    });
    await expect(run([pdfFile('broken.pdf')])).rejects.toThrow(/not a valid, readable PDF/i);
  });

  it('explains a password-protected PDF', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('No password given')),
    });
    await expect(run([pdfFile('locked.pdf')])).rejects.toThrow(/password-protected/i);
  });

  it('refuses a language with no vendored model', async () => {
    await expect(run([pdfFile()], { language: 'jpn' })).rejects.toThrow(/not a language/i);
  });

  it('refuses a page range outside the document', async () => {
    await expect(run([pdfFile()], { pages: '9-12' })).rejects.toThrow(/outside this PDF/i);
  });

  it('releases the pdf.js document when the plan is rejected', async () => {
    const document = fakeDocument();
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    await expect(run([pdfFile()], { language: 'jpn' })).rejects.toThrow(ToolError);
    expect(document.destroy).toHaveBeenCalled();
  });
});
