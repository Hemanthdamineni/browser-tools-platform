/**
 * Pure, unit-testable core for `pdf-unlock`.
 *
 * Design
 * ------
 * Input   one password-protected PDF (`application/pdf`) plus the password its
 *         owner already knows.
 * Output  the same PDF with that password removed, produced by the qpdf CLI
 *         compiled to WebAssembly.
 *
 * Nothing here touches the DOM, a canvas or the network: the wasm module is
 * *passed in* (`createQpdfEngine`), so the argument builder, the validation and
 * the error mapping are all testable without loading 1.3 MB of WebAssembly.
 * Loading it (a dynamic `import()` of the glue plus a `fetch` of `qpdf.wasm`
 * from this origin) lives in `pdf-unlock.qpdf.ts`.
 *
 * Honesty rule
 * ------------
 * This tool never tries to crack a password. qpdf only decrypts when the
 * password the user supplies is correct; a wrong one is reported as such and
 * the file stays locked. If the file is damaged or uses an unsupported scheme,
 * that is reported too — never a brute-force attempt and never a fake success.
 *
 * Edge cases handled here
 * -----------------------
 * - empty password                  → `ToolError`; there is nothing to unlock with.
 * - whitespace-only password        → `ToolError` (three spaces protect and
 *   unlock nothing). Spaces *inside* a password are never touched.
 * - empty file / file without a PDF header → `ToolError` before the wasm is
 *   even downloaded (the header is looked for in the first 1024 bytes, which is
 *   what the PDF standard allows).
 * - PDF that is not encrypted        → refused up front, so the user learns
 *   there is no password to remove instead of getting a confusing pass-through.
 * - wrong password                  → `ToolError` saying the password is wrong.
 * - damaged / unsupported structure → `ToolError` saying so, with qpdf's own
 *   cleaned-up line as the hint.
 * - huge PDF                        → `assertWithinLimit`.
 */
import { PDFDocument } from 'pdf-lib';
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';

/** Hard ceiling for a single input; beyond this a browser tab is likely to choke. */
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;

/** Paths inside qpdf's in-memory file system. */
export const INPUT_PATH = '/input.pdf';
export const OUTPUT_PATH = '/unlocked.pdf';

/** The header every PDF starts with. */
const PDF_HEADER = '%PDF-';

/** How far into the file the header may sit (PDF 32000-1, 7.5.2). */
const HEADER_SEARCH_BYTES = 1024;

export interface UnlockPlan {
  /** The password the PDF was protected with. Never empty. */
  password: string;
}

export interface PdfInspection {
  /** The trailer points at an `/Encrypt` dictionary. */
  encrypted: boolean;
  /** Page count when the document could be read; 0 when it could not. */
  pages: number;
}

/**
 * Which failure qpdf is describing. Kept as data so the message wording and
 * the classification are each unit-testable on their own.
 */
export type UnlockFailureKind = 'wrong-password' | 'not-encrypted' | 'corrupt' | 'unknown';

export interface DecryptFailure {
  kind: UnlockFailureKind;
  message: string;
  hint?: string;
}

/* -------------------------------------------------------------------------- */
/*  Input checks                                                              */
/* -------------------------------------------------------------------------- */

export function assertWithinLimit(size: number, limit = MAX_INPUT_BYTES): void {
  if (size > limit) {
    throw new ToolError(
      `This PDF is ${formatBytes(size)} — too large to unlock in a browser tab.`,
      `Files up to ${formatBytes(limit)} are supported.`,
    );
  }
}

export function assertPdfHeader(bytes: Uint8Array): void {
  if (!bytes.byteLength) {
    throw new ToolError('That file is empty.', 'Choose a PDF that has some content.');
  }
  const window = bytes.subarray(0, Math.min(bytes.byteLength, HEADER_SEARCH_BYTES));
  for (let i = 0; i + PDF_HEADER.length <= window.length; i++) {
    let match = true;
    for (let j = 0; j < PDF_HEADER.length; j++) {
      if (window[i + j] !== PDF_HEADER.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return;
  }
  throw new ToolError(
    'This file is not a PDF.',
    'It does not start with a PDF header (%PDF-). Choose a PDF file.',
  );
}

/**
 * Read what we can about a PDF with pdf-lib: whether it is encrypted, and how
 * many pages it has. A file pdf-lib cannot parse is reported as unencrypted —
 * qpdf is the more tolerant reader and has the final say on the structure.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  // pdf-lib recognises its input with `instanceof`, which is realm-sensitive:
  // a view built by another realm (a test runner's `TextEncoder`, say) would be
  // rejected as "not a Uint8Array". A same-realm view — every one in the
  // browser — is passed straight through.
  const forPdfLib = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    // `ignoreEncryption` lets the trailer be read either way, so the answer
    // comes from pdf-lib's own `isEncrypted` flag rather than from the wording
    // of an error message. An encrypted document has no readable pages, hence
    // the page count of 0.
    const doc = await PDFDocument.load(forPdfLib, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    return { encrypted: doc.isEncrypted, pages: doc.isEncrypted ? 0 : doc.getPageCount() };
  } catch {
    // pdf-lib could not make sense of the file at all. That is not proof of
    // anything: qpdf, the more tolerant reader, still gets to judge it.
    return { encrypted: false, pages: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/*  Password plan                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Validate the workbench values into an `UnlockPlan`. The password is required
 * and must have at least one visible character; spaces *inside* it are never
 * touched, so a passphrase like "open sesame" works.
 */
export function planUnlock(values: Record<string, unknown>): UnlockPlan {
  const password = String(values.password ?? '');
  if (!password) {
    throw new ToolError(
      'Enter the password this PDF is locked with.',
      'Without a password there is nothing to unlock the file with.',
    );
  }
  if (!password.trim()) {
    throw new ToolError(
      'That password is only spaces.',
      'Use the actual password, which has at least one visible character.',
    );
  }
  return { password };
}

/* -------------------------------------------------------------------------- */
/*  qpdf command line                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `qpdf --password=<pw> --decrypt -- <in> <out>`.
 *
 * The password is one argv entry (qpdf takes it as a single `--password=` word),
 * however many spaces, quotes, backslashes, newlines or emoji it contains — the
 * wasm build is called directly, so nothing re-parses or re-quotes it.
 */
export function buildDecryptArgs(
  password: string,
  input = INPUT_PATH,
  output = OUTPUT_PATH,
): string[] {
  return ['--password=' + password, '--decrypt', '--', input, output];
}

/**
 * Turn qpdf's stderr into a classification and a message a person can act on.
 *
 * The first meaningful line is kept (with qpdf's prefixes removed) as the hint.
 * The key distinction this tool must make is wrong password (the user knows
 * the password but mistyped it — say so plainly, and never hint at cracking)
 * versus a corrupt or unsupported file (say so, with qpdf's own line as the
 * hint). Every other refusal falls back to a neutral message.
 */
export function classifyDecryptFailure(stderr: string[], exitCode: number): DecryptFailure {
  const lines = stderr
    .map((line) =>
      line
        .replace(/^(this\.program|qpdf):\s*/i, '')
        .replace(/^WARNING:\s*/i, '')
        .trim(),
    )
    .filter(Boolean);
  const first = lines[0] ?? '';

  if (
    /invalid password|incorrect password|password (is )?wrong|wrong password|password.*does not match|authentication/i.test(
      first,
    )
  ) {
    return {
      kind: 'wrong-password',
      message: 'The password is wrong.',
      hint: 'Check the password — letter case and any leading or trailing spaces count. If you do not know it, this file cannot be opened: no password is ever cracked here.',
    };
  }
  if (/is not encrypted|not (password |encrypted|protected)|no password/i.test(first)) {
    return {
      kind: 'not-encrypted',
      message: 'This PDF is not password-protected.',
      hint: 'There is no password to remove — the file should already open without one.',
    };
  }
  if (/can't find pdf header|does not start with|not a pdf/i.test(first)) {
    return {
      kind: 'corrupt',
      message: 'This file is not a PDF.',
      hint: 'The engine could not find a PDF header in it.',
    };
  }
  if (
    /can't find startxref|unable to find trailer|xref|damaged|damage|corrupt|unsupported|encryption dictionary/i.test(
      first,
    )
  ) {
    return {
      kind: 'corrupt',
      message: 'This PDF is damaged or uses an encryption scheme this engine cannot read.',
      hint: first || undefined,
    };
  }
  return {
    kind: 'unknown',
    message: `The engine could not unlock this PDF (exit code ${exitCode}).`,
    hint: first || undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*  The engine                                                                */
/* -------------------------------------------------------------------------- */

/** The slice of the Emscripten module this tool uses. */
export interface QpdfModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    /** Returns a fresh copy in a plain `ArrayBuffer` (single-threaded build). */
    readFile(path: string): Uint8Array<ArrayBuffer>;
  };
  callMain(args: string[]): number;
}

/**
 * qpdf's stderr lines. The engine empties the buffer before every run and reads
 * it back when qpdf refuses, so the failure can be explained in plain language.
 */
export interface QpdfLog {
  stderr: string[];
}

/**
 * Run `start` with `console.warn` redirected into `log.stderr`. Same glue trick
 * as `pdf-protect`: the Emscripten build binds `console.warn` at initialisation
 * and the binding keeps the function it captured, so swapping the method for
 * the duration of `init()` routes every later qpdf message into our buffer.
 */
export async function withStderrCapture<T>(log: QpdfLog, start: () => Promise<T>): Promise<T> {
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    log.stderr.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    return await start();
  } finally {
    console.warn = realWarn;
  }
}

export interface QpdfEngine {
  /** Remove `password` from `bytes`. Throws `ToolError` when qpdf refuses. */
  decrypt(bytes: Uint8Array, password: string): Uint8Array<ArrayBuffer>;
}

export function createQpdfEngine(module: QpdfModule, log: QpdfLog): QpdfEngine {
  return {
    decrypt(bytes: Uint8Array, password: string): Uint8Array<ArrayBuffer> {
      // Never let the password leak back into an error message that could be
      // rendered on screen or logged.
      const redact = (line: string): string =>
        password ? line.split(password).join('[password]') : line;

      log.stderr.length = 0;

      try {
        // writeFile truncates, so a reused module cannot leave stale bytes behind.
        module.FS.writeFile(INPUT_PATH, bytes);
      } catch (error) {
        throw new ToolError(
          'The PDF could not be handed to the decryption engine.',
          error instanceof Error ? error.message : undefined,
        );
      }

      let exitCode: number;
      try {
        exitCode = module.callMain(buildDecryptArgs(password));
      } catch (error) {
        // Emscripten aborts (out of memory, internal failure) land here.
        const detail = error instanceof Error ? error.message : String(error);
        throw new ToolError(
          'The decryption engine stopped unexpectedly.',
          `${detail} — try a smaller PDF or run the tool again.`,
        );
      }

      if (exitCode !== 0) {
        const failure = classifyDecryptFailure(log.stderr.map(redact), exitCode);
        throw new ToolError(failure.message, failure.hint);
      }

      let output: Uint8Array<ArrayBuffer>;
      try {
        output = module.FS.readFile(OUTPUT_PATH);
      } catch {
        throw new ToolError(
          'The decryption engine produced no output.',
          'Nothing was written, so the original file is untouched.',
        );
      }
      if (!output.byteLength) {
        throw new ToolError(
          'The decryption engine produced an empty file.',
          'The original file is untouched.',
        );
      }
      return output;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Naming                                                                    */
/* -------------------------------------------------------------------------- */

/** `report.pdf` → `report-unlocked.pdf`. */
export function unlockedFilename(original: string): string {
  const base = original.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-unlocked.pdf`;
}
