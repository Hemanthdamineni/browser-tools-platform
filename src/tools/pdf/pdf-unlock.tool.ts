import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { abort, firstFile, resolve } from './shared';
import {
  assertPdfHeader,
  assertWithinLimit,
  inspectPdf,
  unprotectedFilename,
} from './pdf-unlock.core';
import { meta } from './pdf-unlock.meta';
import { loadQpdfEngine } from './pdf-protect.qpdf';

/*
 * Lazy loading: this module is only pulled in when the tool runs (the registry
 * turns `*.tool.ts` into a lazy `import()` factory), and the 1.3 MB qpdf
 * WebAssembly build is itself imported on demand inside `loadQpdfEngine()`, so
 * the tool page and the other tools never download it.
 */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  assertWithinLimit(file.size);

  // Validate password early so a missing password is reported before any engine work.
  const userPassword = String(o.userPassword || '').trim();
  if (!userPassword) {
    throw new ToolError('A password is required to unlock the PDF.');
  }

  input.onProgress?.(0.02, 'Reading the PDF');
  const bytes = new Uint8Array(await file.arrayBuffer());
  abort(input);

  // Cheap, deterministic refusals first — before a megabyte of wasm moves.
  assertPdfHeader(bytes);

  input.onProgress?.(0.12, 'Checking the PDF');
  const inspection = await inspectPdf(bytes);
  if (!inspection.encrypted) {
    throw new ToolError(
      'This PDF is not password-protected.',
      'This tool removes a password from an encrypted PDF. The file you selected has no encryption to remove.',
    );
  }
  abort(input);

  input.onProgress?.(0.2, 'Loading the decryption engine');
  const engine = await loadQpdfEngine();
  abort(input);

  input.onProgress?.(0.45, 'Decrypting the PDF');
  const unprotectedBytes = engine.unlock(bytes, userPassword);
  abort(input);

  input.onProgress?.(0.85, 'Verifying the result');
  const check = await inspectPdf(unprotectedBytes);
  if (check.encrypted) {
    throw new ToolError(
      'The result is still encrypted, so it was discarded.',
      'The decryption engine reported success but produced an encrypted file. The password may be incorrect.',
    );
  }

  const filename = unprotectedFilename(file.name);
  input.onProgress?.(1, 'Done');

  return {
    outputs: [{ filename, blob: new Blob([unprotectedBytes], { type: 'application/pdf' }) }],
    notes: [
      'Password protection removed — the file can now be opened without a password.',
      `Pages: ${inspection.pages}`,
    ],
    stats: {
      pages: inspection.pages,
      input: formatBytes(bytes.byteLength),
      output: formatBytes(unprotectedBytes.byteLength),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
