import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { abort, firstFile, resolve } from './shared';
import {
  assertPdfHeader,
  assertWithinLimit,
  inspectPdf,
  planUnlock,
  unlockedFilename,
} from './pdf-unlock.core';
import { meta } from './pdf-unlock.meta';
import { loadQpdfEngine } from './pdf-unlock.qpdf';

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
  const plan = planUnlock(o);

  input.onProgress?.(0.12, 'Checking the PDF');
  // `inspectPdf` never throws: a file pdf-lib cannot read is reported as
  // unencrypted and qpdf — the more tolerant reader — has the final say.
  const inspection = await inspectPdf(bytes);
  if (!inspection.encrypted) {
    throw new ToolError(
      'This PDF is not password-protected.',
      'There is no password to remove — the file should already open without one.',
    );
  }
  abort(input);

  input.onProgress?.(0.2, 'Loading the decryption engine');
  const engine = await loadQpdfEngine();
  abort(input);

  input.onProgress?.(0.45, 'Removing the password');
  const unlockedBytes = engine.decrypt(bytes, plan.password);
  abort(input);

  input.onProgress?.(0.85, 'Verifying the result');
  // A security tool must never report success while the password is still
  // there: the trailer of the result must no longer carry an /Encrypt entry.
  const check = await inspectPdf(unlockedBytes);
  if (check.encrypted) {
    throw new ToolError(
      'The result is still password-protected, so it was discarded.',
      'The engine reported success but produced a file that still carries encryption. Please report this — the original PDF is untouched.',
    );
  }

  const filename = unlockedFilename(file.name);
  input.onProgress?.(1, 'Done');

  const pages = check.pages;
  return {
    outputs: [{ filename, blob: new Blob([unlockedBytes], { type: 'application/pdf' }) }],
    notes: [
      `The password was removed — the file now opens without one (${pages} page${pages === 1 ? '' : 's'}).`,
      'No password is ever guessed here: a wrong password leaves the file locked and is reported as wrong.',
    ],
    stats: {
      pages,
      input: formatBytes(bytes.byteLength),
      output: formatBytes(unlockedBytes.byteLength),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;