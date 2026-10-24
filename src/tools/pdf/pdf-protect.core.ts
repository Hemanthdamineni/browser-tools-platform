/**
 * Pure, unit-testable core for `pdf-protect`.
 *
 * Design
 * ------
 * Input   one unencrypted PDF (`application/pdf`) plus a password plan.
 * Output  the same PDF with AES-256 (revision 6) encryption applied, produced
 *         by the qpdf CLI compiled to WebAssembly.
 *
 * Nothing here touches the DOM, a canvas or the network: the wasm module is
 * *passed in* (`createQpdfEngine`), so the argument builder, the validation and
 * the error mapping are all testable without loading 1.3 MB of WebAssembly.
 * Loading it (a dynamic `import()` of the glue plus a `fetch` of `qpdf.wasm`
 * from this origin) lives in `pdf-protect.qpdf.ts`.
 *
 * Edge cases handled here
 * -----------------------
 * - empty password                  → `ToolError`; there would be nothing to
 *   open the file with.
 * - whitespace-only password        → `ToolError` (a password of three spaces
 *   protects nothing). Spaces *inside* a password are never touched.
 * - password over 127 bytes         → `ToolError`. qpdf happily *encrypts* with
 *   it and then refuses to open the file again, because the PDF standard only
 *   reads the first 127 bytes of a revision-6 password. Refusing is the only
 *   honest answer.
 * - spaces, quotes, backslashes, newlines, unicode, emoji → handed to qpdf
 *   byte-for-byte as one argv entry. There is no shell and no escaping here.
 * - empty file / file without a PDF header → `ToolError` before the wasm is
 *   even downloaded (the header is looked for in the first 1024 bytes, which is
 *   what the PDF standard allows).
 * - already-encrypted input         → detected up front, refused explicitly.
 * - damaged structure               → qpdf's own message, cleaned up and
 *   translated into plain language.
 * - huge PDF                        → `assertWithinLimit`.
 */
import { PDFDocument } from 'pdf-lib';
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';

/** Hard ceiling for a single input; beyond this a browser tab is likely to choke. */
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;

/** qpdf always writes AES-256 (AESv3) for this key length; there is no weaker fallback. */
export const KEY_LENGTH = 256;

/**
 * The PDF standard reads at most 127 bytes of a revision-6 password. qpdf does
 * not warn: it encrypts with the full string and then cannot match it again.
 */
export const MAX_PASSWORD_BYTES = 127;

/** Paths inside qpdf's in-memory file system. */
export const INPUT_PATH = '/input.pdf';
export const OUTPUT_PATH = '/protected.pdf';

/** The header every PDF starts with. */
const PDF_HEADER = '%PDF-';

/** How far into the file the header may sit (PDF 32000-1, 7.5.2). */
const HEADER_SEARCH_BYTES = 1024;

export interface ProtectPlan {
  /** Password every reader needs to open the file. Never empty. */
  userPassword: string;
  /** Password that unlocks full permissions. Defaults to `userPassword`. */
  ownerPassword: string;
  allowPrint: boolean;
  allowCopy: boolean;
  allowModify: boolean;
}

export interface PdfInspection {
  /** The trailer points at an `/Encrypt` dictionary. */
  encrypted: boolean;
  /** Page count when the document could be read; 0 when it could not. */
  pages: number;
}

/* -------------------------------------------------------------------------- */
/*  Input checks                                                              */
/* -------------------------------------------------------------------------- */

export function assertWithinLimit(size: number, limit = MAX_INPUT_BYTES): void {
  if (size > limit) {
    throw new ToolError(
      `This PDF is ${formatBytes(size)} — too large to encrypt in a browser tab.`,
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
  // rejected as "not a Uint8Array" and the file wrongly reported as unencrypted.
  // A same-realm view — every one in the browser — is passed straight through.
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

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return !['', '0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
  }
  return fallback;
}

function assertPasswordLength(password: string, label: string): void {
  const bytes = new TextEncoder().encode(password).length;
  if (bytes > MAX_PASSWORD_BYTES) {
    throw new ToolError(
      `The ${label} is too long (${bytes} bytes).`,
      `PDF encryption only reads the first ${MAX_PASSWORD_BYTES} bytes, so a longer password would lock the file for good.`,
    );
  }
}

/**
 * Validate the workbench values and normalise them into a `ProtectPlan`.
 * An empty owner password means "same password as the user password", which is
 * what qpdf needs to still allow the owner to change permissions later.
 */
export function planProtection(values: Record<string, unknown>): ProtectPlan {
  const userPassword = String(values.userPassword ?? '');
  if (!userPassword) {
    throw new ToolError(
      'Enter the password that should open this PDF.',
      'Without a password there is nothing protecting the file.',
    );
  }
  if (!userPassword.trim()) {
    throw new ToolError(
      'That password is only spaces.',
      'Use a password with at least one visible character.',
    );
  }
  assertPasswordLength(userPassword, 'password');

  const ownerPassword = String(values.ownerPassword ?? '');
  if (ownerPassword) assertPasswordLength(ownerPassword, 'owner password');

  return {
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    allowPrint: toBoolean(values.allowPrint, true),
    allowCopy: toBoolean(values.allowCopy, true),
    allowModify: toBoolean(values.allowModify, true),
  };
}

/* -------------------------------------------------------------------------- */
/*  qpdf command line                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The permission flags qpdf should receive, in a stable order. Nothing is
 * emitted for a permission the user granted: qpdf's default for AES-256 is to
 * allow everything, and printing a restriction only when it was asked for keeps
 * the command line honest.
 */
export function permissionFlags(plan: ProtectPlan): string[] {
  const flags: string[] = [];
  if (!plan.allowPrint) flags.push('--print=none');
  if (!plan.allowCopy) flags.push('--extract=n');
  // `--modify=none` turns off assembly, annotation, form filling and other
  // modification. It deliberately does not touch extraction, so "may copy but
  // may not edit" survives the round trip.
  if (!plan.allowModify) flags.push('--modify=none');
  return flags;
}

/**
 * `qpdf --encrypt <user> <owner> 256 [permissions] -- <in> <out>`.
 *
 * The passwords are single argv entries, however many spaces, quotes,
 * backslashes, newlines or emoji they contain — the wasm build is called
 * directly, so nothing re-parses or re-quotes them.
 */
export function buildEncryptArgs(
  plan: ProtectPlan,
  input = INPUT_PATH,
  output = OUTPUT_PATH,
): string[] {
  return [
    '--encrypt',
    plan.userPassword,
    plan.ownerPassword,
    String(KEY_LENGTH),
    ...permissionFlags(plan),
    '--',
    input,
    output,
  ];
}

/**
 * Turn qpdf's stderr into a message a person can act on. The first meaningful
 * line is kept (with qpdf's prefixes removed) as the hint, so the user sees what
 * the engine actually objected to.
 */
export function describeQpdfFailure(
  stderr: string[],
  exitCode: number,
): { message: string; hint?: string } {
  const lines = stderr
    .map((line) =>
      line
        .replace(/^(this\.program|qpdf):\s*/i, '')
        .replace(/^WARNING:\s*/i, '')
        .trim(),
    )
    .filter(Boolean);
  const first = lines[0] ?? '';

  if (/invalid password/i.test(first)) {
    return {
      message: 'This PDF is already password-protected.',
      hint: 'You cannot add a second password: open the file with its current password and remove that protection first. Existing protection is never replaced silently.',
    };
  }
  if (/can't find pdf header|does not start with|not a pdf/i.test(first)) {
    return {
      message: 'This file is not a PDF.',
      hint: 'The engine could not find a PDF header in it.',
    };
  }
  if (/can't find startxref|unable to find trailer|xref/i.test(first)) {
    return {
      message: 'This PDF is damaged and cannot be encrypted.',
      hint: `The engine could not read its cross-reference table: ${first}`,
    };
  }
  if (/password is too long|longer than 127/i.test(first)) {
    return { message: 'The password is too long.', hint: first };
  }
  if (/encryption key length/i.test(first)) {
    return { message: 'The encryption engine rejected the requested key length.', hint: first };
  }
  if (/damaged|damage/i.test(first)) {
    return { message: 'This PDF is damaged and cannot be encrypted.', hint: first };
  }
  const fallback = `The encryption engine could not process this PDF (exit code ${exitCode}).`;
  return { message: fallback, hint: first || undefined };
}

/* -------------------------------------------------------------------------- */
/*  The engine                                                                */
/* -------------------------------------------------------------------------- */

/** The slice of the Emscripten module this tool uses. */
export interface QpdfModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    /**
     * Emscripten's `FS.readFile` returns a fresh copy in a plain `ArrayBuffer`
     * (the build is single-threaded, so there is no shared memory), which is
     * exactly what a `Blob` can be handed without another copy.
     */
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
 * Run `start` with `console.warn` redirected into `log.stderr`.
 *
 * The Emscripten glue in `@jspawn/qpdf-wasm` has no `print`/`printErr` support:
 * it binds `console.log` and `console.warn` when the module is initialised and
 * sends qpdf's diagnostics straight there (stdout to `log`, stderr to `warn`).
 * Because the binding keeps the function it captured, swapping the method for
 * the duration of `init()` routes every later qpdf message into our buffer —
 * and swapping it back immediately means no other tool sharing the worker ever
 * sees a patched console.
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
  /** Encrypt `bytes` according to `plan`. Throws `ToolError` when qpdf refuses. */
  protect(bytes: Uint8Array, plan: ProtectPlan): Uint8Array<ArrayBuffer>;
}

export function createQpdfEngine(module: QpdfModule, log: QpdfLog): QpdfEngine {
  return {
    protect(bytes: Uint8Array, plan: ProtectPlan): Uint8Array<ArrayBuffer> {
      const redact = (line: string): string =>
        [plan.userPassword, plan.ownerPassword].reduce(
          (text, secret) => (secret ? text.split(secret).join('[password]') : text),
          line,
        );

      log.stderr.length = 0;

      try {
        // writeFile truncates, so a reused module cannot leave stale bytes behind.
        module.FS.writeFile(INPUT_PATH, bytes);
      } catch (error) {
        throw new ToolError(
          'The PDF could not be handed to the encryption engine.',
          error instanceof Error ? error.message : undefined,
        );
      }

      let exitCode: number;
      try {
        exitCode = module.callMain(buildEncryptArgs(plan));
      } catch (error) {
        // Emscripten aborts (out of memory, internal failure) land here.
        const detail = error instanceof Error ? error.message : String(error);
        throw new ToolError(
          'The encryption engine stopped unexpectedly.',
          `${detail} — try a smaller PDF or run the tool again.`,
        );
      }

      if (exitCode !== 0) {
        const failure = describeQpdfFailure(log.stderr.map(redact), exitCode);
        throw new ToolError(failure.message, failure.hint);
      }

      let output: Uint8Array<ArrayBuffer>;
      try {
        output = module.FS.readFile(OUTPUT_PATH);
      } catch {
        throw new ToolError(
          'The encryption engine produced no output.',
          'Nothing was written, so the original file is untouched.',
        );
      }
      if (!output.byteLength) {
        throw new ToolError(
          'The encryption engine produced an empty file.',
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

/** `report.pdf` → `report-protected.pdf`. */
export function protectedFilename(original: string): string {
  const base = original.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-protected.pdf`;
}

/** One line for the result card: which restrictions the file now carries. */
export function describePermissions(plan: ProtectPlan): string {
  const blocked: string[] = [];
  if (!plan.allowPrint) blocked.push('printing');
  if (!plan.allowCopy) blocked.push('copying text and images');
  if (!plan.allowModify) blocked.push('editing');
  if (!blocked.length)
    return 'Printing, copying and editing stay allowed for anyone with the password.';
  return `Blocked for anyone who opens it with the user password: ${blocked.join(', ')}.`;
}
