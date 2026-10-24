import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { abort, firstFile, resolve } from './shared';
import {
  assertPdfHeader,
  assertWithinLimit,
  describePermissions,
  inspectPdf,
  planProtection,
  protectedFilename,
} from './pdf-protect.core';
import { meta } from './pdf-protect.meta';
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

  input.onProgress?.(0.02, 'Reading the PDF');
  const bytes = new Uint8Array(await file.arrayBuffer());
  abort(input);

  // Cheap, deterministic refusals first — before a megabyte of wasm moves.
  assertPdfHeader(bytes);

  // Then the options, so a forgotten password is reported before qpdf runs.
  const plan = planProtection(o);

  input.onProgress?.(0.12, 'Checking the PDF');
  // `inspectPdf` never throws: a file pdf-lib cannot read is reported as
  // unencrypted and qpdf — the more tolerant reader — has the final say.
  const inspection = await inspectPdf(bytes);
  if (inspection.encrypted) {
    throw new ToolError(
      'This PDF is already password-protected.',
      'This tool adds a password to an unprotected PDF. Open the file with its current password and remove that protection first — existing protection is never replaced silently.',
    );
  }
  abort(input);

  input.onProgress?.(0.2, 'Loading the encryption engine');
  const engine = await loadQpdfEngine();
  abort(input);

  input.onProgress?.(0.45, 'Encrypting with AES-256');
  const protectedBytes = engine.protect(bytes, plan);
  abort(input);

  input.onProgress?.(0.85, 'Verifying the result');
  // A security tool must never report success without the encryption actually
  // being there: the trailer of the result has to carry an /Encrypt dictionary.
  const check = await inspectPdf(protectedBytes);
  if (!check.encrypted) {
    throw new ToolError(
      'The result is not encrypted, so it was discarded.',
      'The encryption engine reported success but produced an unprotected file. Please report this — the original PDF is untouched.',
    );
  }

  const filename = protectedFilename(file.name);
  input.onProgress?.(1, 'Done');

  const restrictions = describePermissions(plan);
  return {
    outputs: [{ filename, blob: new Blob([protectedBytes], { type: 'application/pdf' }) }],
    notes: [
      'AES-256 encryption applied (PDF revision 6) — the file cannot be opened without the password.',
      restrictions,
      'There is no recovery: if you lose the password, the PDF cannot be opened again.',
    ],
    stats: {
      encryption: 'AES-256 (revision 6)',
      pages: inspection.pages,
      input: formatBytes(bytes.byteLength),
      output: formatBytes(protectedBytes.byteLength),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
