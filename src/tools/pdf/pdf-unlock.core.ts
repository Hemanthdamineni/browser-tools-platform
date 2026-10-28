/**
 * Pure, unit-testable core for `pdf-unlock`.
 *
 * The heavy WebAssembly (qpdf) is isolated in `pdf-protect.qpdf.ts` and loaded
 * on demand. This file only contains logic that does not need the engine.
 */
import { PDFDocument } from 'pdf-lib';
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';

/** Hard ceiling for a single input; beyond this a browser tab is likely to choke. */
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;

/** The header every PDF starts with. */
const PDF_HEADER = '%PDF-';

/** How far into the file the header may sit (PDF 32000-1, 7.5.2). */
const HEADER_SEARCH_BYTES = 1024;

export interface UnlockPlan {
  userPassword: string;
}

export interface PdfInspection {
  encrypted: boolean;
  pages: number;
}

/** `report.pdf` → `report-unlocked.pdf`. */
export function unprotectedFilename(original: string): string {
  const base = original.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-unlocked.pdf`;
}

/* -------------------------------------------------------------------------- */
/*  Input checks                                                              */
/* -------------------------------------------------------------------------- */

export function assertWithinLimit(size: number, limit = MAX_INPUT_BYTES): void {
  if (size > limit) {
    throw new ToolError(
      'This PDF is too large to decrypt in the browser.',
      `The limit is ${Math.round(limit / 1024 / 1024)} MB. Consider a desktop tool for bigger files.`,
    );
  }
}

export function assertPdfHeader(bytes: Uint8Array): void {
  if (!bytes.byteLength) {
    throw new ToolError('The file is empty.', 'A zero-byte file cannot be a PDF.');
  }
  const slice = bytes.subarray(0, Math.min(bytes.byteLength, HEADER_SEARCH_BYTES));
  const text = new TextDecoder('latin1', { fatal: false }).decode(slice);
  if (!text.startsWith(PDF_HEADER)) {
    throw new ToolError(
      'This file does not look like a PDF.',
      `Expected header "%PDF-" within the first ${HEADER_SEARCH_BYTES} bytes.`,
    );
  }
}

/**
 * Read what we can about a PDF with pdf-lib: whether it is encrypted, and how
 * many pages it has. A file pdf-lib cannot parse is reported as unencrypted —
 * qpdf is the more tolerant reader and has the final say on the structure.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const forPdfLib = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    const doc = await PDFDocument.load(forPdfLib, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return { encrypted: doc.isEncrypted, pages: doc.isEncrypted ? 0 : doc.getPageCount() };
  } catch {
    return { encrypted: false, pages: 0 };
  }
}

/**
 * Validate the workbench values and normalise them into a `UnlockPlan`.
 */
export function planUnlock(values: Record<string, unknown>): UnlockPlan {
  const userPassword = String(values.userPassword ?? '').trim();
  return { userPassword };
}