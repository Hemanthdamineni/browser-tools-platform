/**
 * Pure helpers for the OCR tool: the language list, the option validation, the
 * output filename and the text clean-up.
 *
 * Nothing in here touches the DOM, the network or the Tesseract engine, so it
 * can be unit-tested on its own (see `image-ocr.test.ts`).
 */
import { ToolError } from '@/lib/types';
import langData from './ocr-langs.json';

export interface OcrLanguage {
  /** Tesseract language code, e.g. `eng`. */
  readonly code: string;
  /** Human-readable name shown in the language picker. */
  readonly label: string;
}

/**
 * The languages this build can actually read. The list is shared with
 * `scripts/vendor-tesseract.mjs`, which copies exactly these language models
 * into `public/vendor/tesseract/lang/` — a language that is not vendored is a
 * language the tool must refuse.
 */
export const OCR_LANGUAGES: readonly OcrLanguage[] = langData.languages;

export const OCR_LANGUAGE_CODES: readonly string[] = OCR_LANGUAGES.map((l) => l.code);

export const DEFAULT_OCR_LANGUAGE = 'eng';

/** True when `code` names a language whose model is vendored with this build. */
export function isSupportedOcrLanguage(code: unknown): boolean {
  return typeof code === 'string' && OCR_LANGUAGE_CODES.includes(code);
}

/**
 * Validate the language picker value. An unknown language is a user error —
 * we say so instead of quietly falling back to English, because "I asked for
 * German and got English" is worse than a clear message.
 */
export function resolveOcrLanguage(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!code) return DEFAULT_OCR_LANGUAGE;
  if (!isSupportedOcrLanguage(code)) {
    throw new ToolError(
      `“${code}” is not a language this tool can read.`,
      `Pick one of: ${OCR_LANGUAGES.map((l) => l.label).join(', ')}.`,
    );
  }
  return code;
}

/** The name of a language, for messages and stats. */
export function ocrLanguageLabel(code: string): string {
  return OCR_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export interface OcrMode {
  readonly value: string;
  readonly label: string;
  /** Tesseract's `tessedit_pageseg_mode`. */
  readonly psm: string;
}

/**
 * The page-segmentation modes offered in the UI. `auto` (3) is the right
 * default for scans and photos; the others exist for screenshots, receipts
 * and single-line captures.
 */
export const OCR_MODES: readonly OcrMode[] = [
  { value: 'auto', label: 'Automatic — any layout', psm: '3' },
  { value: 'column', label: 'A single column of text', psm: '4' },
  { value: 'block', label: 'One block of text', psm: '6' },
  { value: 'line', label: 'A single line of text', psm: '7' },
  { value: 'sparse', label: 'Sparse text — a few words in a picture', psm: '11' },
];

/** Validate the layout picker value and return the matching mode. */
export function resolveOcrMode(value: unknown): OcrMode {
  const raw = typeof value === 'string' ? value : 'auto';
  const found = OCR_MODES.find((m) => m.value === raw);
  if (!found) {
    throw new ToolError(
      `“${raw}” is not a text layout this tool understands.`,
      `Pick one of: ${OCR_MODES.map((m) => m.label).join(', ')}.`,
    );
  }
  return found;
}

/**
 * The name of the `.txt` download for an image. The extension of the source
 * file is replaced, everything before it is kept.
 */
export function ocrOutputName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '') || 'image';
  return `${base.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
}

/**
 * Tidy the raw text Tesseract returns: normalise line endings, drop trailing
 * spaces and collapse the runs of blank lines it likes to leave behind.
 */
export function cleanOcrText(raw: string): string {
  const normalised = raw.replace(/\r\n?/g, '\n').replace(/\f/g, '\n\n');
  const lines = normalised.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
  const kept: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line === '') {
      blanks += 1;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    kept.push(line);
  }
  return kept.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

export interface OcrTextStats {
  characters: number;
  words: number;
  lines: number;
}

/** Count the characters, words and lines of recognised text. */
export function ocrTextStats(text: string): OcrTextStats {
  const trimmed = text.trim();
  return {
    characters: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: trimmed ? trimmed.split('\n').length : 0,
  };
}

/**
 * Join the recognised text of several files into one block, with a header per
 * file so the reader knows which image a paragraph came from.
 */
export function joinOcrSections(sections: { name: string; text: string }[]): string {
  if (sections.length === 1) return sections[0]?.text ?? '';
  return sections.map((s) => `── ${s.name} ──\n\n${s.text}`.trimEnd()).join('\n\n');
}
