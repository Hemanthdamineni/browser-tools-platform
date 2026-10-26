/**
 * Pure, unit-testable core for `pdf-organize`.
 *
 * Design
 * ------
 * Input   one PDF file (`application/pdf`).
 * Options `pages` — the page plan: a JSON array of
 *           `{ source?: number, rotate?: number, blank?: boolean, size?: string }`
 *           entries. `source` is the 1-based page index in the *original* PDF;
 *           a blank page has no `source` but carries `blank: true` and a page
 *           `size`. The literal `all` keeps every page in its original order.
 *         `blankSize` — the page size used for blank pages that do not name
 *           one themselves.
 * Output  a rebuilt PDF that contains exactly the planned pages, in the planned
 *         order, with the planned rotations and the planned blank pages.
 *
 * Everything in this module is deterministic, DOM-free and side-effect free
 * (except `assembleInto`, which only touches the pdf-lib documents it is
 * handed), so it can be unit-tested in Node without a browser. The organiser
 * panel imports the plan types and helpers from here but never pulls pdf-lib
 * into the page: pdf-lib is only loaded inside the worker that runs the tool.
 */
import type { PDFDocument, Rotation } from 'pdf-lib';
import { ToolError } from '@/lib/types';

/** One planned output page. */
export interface PlanEntry {
  /** 1-based page index in the source PDF. Absent for blank pages. */
  source?: number;
  /** Extra clockwise rotation in degrees (0, 90, 180 or 270). */
  rotate: number;
  /** True for an inserted blank page. */
  blank: boolean;
  /** Page size id for blank pages (see `PAGE_SIZES`). */
  size?: string;
}

export interface PageSize {
  /** Canonical id (`a4`, `letter`, …). */
  id: string;
  /** Width in PDF points. */
  width: number;
  /** Height in PDF points. */
  height: number;
  /** Human-readable label. */
  label: string;
}

/** The page sizes a blank page can use (points, 1 pt = 1/72 in). */
export const PAGE_SIZES: Record<string, PageSize> = {
  a4: { id: 'a4', width: 595.28, height: 841.89, label: 'A4 portrait' },
  'a4-landscape': { id: 'a4-landscape', width: 841.89, height: 595.28, label: 'A4 landscape' },
  letter: { id: 'letter', width: 612, height: 792, label: 'Letter portrait' },
  'letter-landscape': {
    id: 'letter-landscape',
    width: 792,
    height: 612,
    label: 'Letter landscape',
  },
};

/** The size used when nothing else is specified. */
export const DEFAULT_BLANK_SIZE = 'a4';

/** Hard ceiling for the number of pages in one plan. */
export const MAX_PLAN_PAGES = 5000;

/**
 * Normalise a rotation to 0/90/180/270. Anything that is not a multiple of 90
 * is rejected — a PDF page can only be turned in quarter turns.
 */
export function normalizeRotation(value: unknown, position?: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  const where = position ? `Page ${position} of the plan` : 'A page';
  if (!Number.isFinite(num)) {
    throw new ToolError(`${where} has an unreadable rotation.`, 'Use 0, 90, 180 or 270 degrees.');
  }
  if (num % 90 !== 0) {
    throw new ToolError(
      `${where} is rotated by ${num}°, which is not a whole turn.`,
      'Use 0, 90, 180 or 270 degrees.',
    );
  }
  const turns = Math.round(num / 90);
  return (((turns % 4) + 4) % 4) * 90;
}

/**
 * Look up a blank page size. `null`/unknown ids are a user-facing error: a
 * blank page without a size cannot be drawn.
 */
export function resolveBlankSize(id: unknown, position?: number): PageSize {
  const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
  const size = Object.prototype.hasOwnProperty.call(PAGE_SIZES, key) ? PAGE_SIZES[key] : undefined;
  if (!size) {
    const where = position ? `Blank page ${position}` : 'A blank page';
    throw new ToolError(
      `${where} has no page size.`,
      `Choose one of: ${Object.keys(PAGE_SIZES).join(', ')}.`,
    );
  }
  return size;
}

/**
 * Parse and validate the page plan.
 *
 * Rejects — with a `ToolError` — an empty plan, invalid JSON, a plan that is
 * not an array, an entry that is not an object, an entry without a source
 * page, a source page outside the document, the same source page used twice,
 * a rotation that is not a multiple of 90 and a blank page without a size.
 */
export function parsePlan(raw: unknown, totalPages: number, blankSize?: unknown): PlanEntry[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new ToolError('This PDF has no pages to organise.');
  }
  const text = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!text) {
    throw new ToolError('The page plan is empty.', 'Choose at least one page to keep.');
  }
  if (text.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => ({
      source: i + 1,
      rotate: 0,
      blank: false,
    }));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ToolError(
      'The page plan is not valid JSON.',
      'Use an array such as [{"source":1,"rotate":90}] — or the word "all".',
    );
  }
  if (!Array.isArray(parsed)) {
    throw new ToolError('The page plan must be a JSON array of pages.');
  }
  if (!parsed.length) {
    throw new ToolError(
      'The page plan is empty.',
      'A PDF needs at least one page — keep something in the plan.',
    );
  }
  if (parsed.length > MAX_PLAN_PAGES) {
    throw new ToolError(
      `The page plan has ${parsed.length} pages — too many for one PDF.`,
      `Up to ${MAX_PLAN_PAGES} pages are supported.`,
    );
  }

  const plan: PlanEntry[] = [];
  const used = new Set<number>();
  parsed.forEach((rawEntry, index) => {
    const position = index + 1;
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      throw new ToolError(`Entry ${position} of the page plan is not a page.`);
    }
    const entry = rawEntry as Record<string, unknown>;
    const rotate = normalizeRotation(entry.rotate ?? 0, position);

    if (entry.blank === true) {
      if (entry.source !== undefined && entry.source !== null) {
        throw new ToolError(
          `Blank page ${position} must not also point at a source page.`,
          'A blank page is new — it has no source.',
        );
      }
      const size = resolveBlankSize(entry.size ?? blankSize, position);
      plan.push({ rotate, blank: true, size: size.id });
      return;
    }

    if (entry.source === undefined || entry.source === null) {
      throw new ToolError(
        `Page ${position} of the plan does not point at a source page.`,
        'Give it a "source" page number, or mark it as "blank": true.',
      );
    }
    const source = typeof entry.source === 'number' ? entry.source : Number(entry.source);
    if (!Number.isInteger(source)) {
      throw new ToolError(
        `Page ${position} of the plan points at "${entry.source}", which is not a whole page number.`,
      );
    }
    if (source < 1 || source > totalPages) {
      throw new ToolError(
        `Page ${source} is outside this PDF (1–${totalPages}).`,
        'The plan refers to the page numbers of the file you picked.',
      );
    }
    if (used.has(source)) {
      throw new ToolError(
        `Page ${source} is in the plan twice.`,
        'Each source page can be used only once.',
      );
    }
    used.add(source);
    plan.push({ source, rotate, blank: false });
  });

  return plan;
}

/** Serialise a plan back to the JSON the tool understands. */
export function planToJson(plan: PlanEntry[]): string {
  return JSON.stringify(
    plan.map((entry) => {
      const out: Record<string, unknown> = { rotate: entry.rotate, blank: entry.blank };
      if (entry.blank) out.size = entry.size ?? DEFAULT_BLANK_SIZE;
      else out.source = entry.source;
      return out;
    }),
  );
}

/**
 * Fill `out` with the pages of `plan`, in the planned order.
 *
 * Source pages are copied in one pass and then added in the planned order;
 * the planned rotation is added to whatever rotation the page already has, so
 * the result looks exactly like the preview the user arranged.
 */
export async function assembleInto(
  out: PDFDocument,
  source: PDFDocument,
  plan: PlanEntry[],
  onProgress?: (fraction: number, message: string) => void,
): Promise<void> {
  if (!plan.length) {
    throw new ToolError(
      'The page plan is empty.',
      'A PDF needs at least one page — keep something in the plan.',
    );
  }
  const indices = plan.filter((entry) => !entry.blank).map((entry) => entry.source! - 1);
  const copied = indices.length ? await out.copyPages(source, indices) : [];
  let cursor = 0;
  for (const entry of plan) {
    if (entry.blank) {
      const size = resolveBlankSize(entry.size);
      out.addPage([size.width, size.height]);
    } else {
      const page = copied[cursor++];
      if (!page) {
        throw new ToolError('The page plan does not match this PDF.', 'Pick the file again.');
      }
      const angle = (page.getRotation().angle + entry.rotate) % 360;
      // `RotationTypes.Degrees` is the string 'degrees' and pdf-lib compares
      // the tag by value, so the literal is enough here.
      page.setRotation({ type: 'degrees', angle } as unknown as Rotation);
      out.addPage(page);
    }
    onProgress?.(cursor / plan.length, `Added page ${cursor} of ${plan.length}`);
  }
}
