import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PDFDocument,
  abort,
  configurePdfWorker,
  firstFile,
  loadPdfBytes,
  output,
  resolve,
} from './shared';
import { meta } from './pdf-redact.meta';

configurePdfWorker(pdfjsLib);

/* -------------------------------------------------------------------------- */
/*  Pure plan maths — geometry and validation, testable without a canvas       */
/* -------------------------------------------------------------------------- */

/** A redaction rectangle in percent (0–100) of the displayed page. */
export interface RedactRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One planned page: a 1-based page number and the rectangles to burn on it. */
export interface RedactEntry {
  page: number;
  regions: RedactRegion[];
}

/** A rectangle in whole rendered pixels, top-left origin. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest rectangle worth burning, in percent of each axis. */
export const MIN_REDACT_PERCENT = 1;

/** Scale range accepted from the option form: rendered pixels per PDF point. */
export const MIN_REDACT_SCALE = 1;
export const MAX_REDACT_SCALE = 4;

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * The size a page takes when printed to a bitmap: the media box in points with
 * a quarter turn applied, multiplied by the scale (72 dpi is scale 1).
 */
export function pagePixelSize(
  widthPt: number,
  heightPt: number,
  rotation: number,
  scale: number,
): { width: number; height: number } {
  const turn = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const swapped = turn === 90 || turn === 270;
  return swapped
    ? { width: heightPt * scale, height: widthPt * scale }
    : { width: widthPt * scale, height: heightPt * scale };
}

/**
 * Map a percent rectangle onto a rendered page of `widthPx × heightPx` pixels,
 * rounding to whole pixels and clipping to the page. Returns `null` when it
 * cannot cover a single pixel, so a degenerate region is never burned as an
 * invisible no-op.
 */
export function regionToPixels(
  region: RedactRegion,
  widthPx: number,
  heightPx: number,
): PixelRect | null {
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h) ||
    region.w <= 0 ||
    region.h <= 0 ||
    !(widthPx >= 1) ||
    !(heightPx >= 1)
  ) {
    return null;
  }
  const x0 = clamp(Math.round((region.x / 100) * widthPx), 0, widthPx);
  const y0 = clamp(Math.round((region.y / 100) * heightPx), 0, heightPx);
  const x1 = clamp(Math.round(((region.x + region.w) / 100) * widthPx), 0, widthPx);
  const y1 = clamp(Math.round(((region.y + region.h) / 100) * heightPx), 0, heightPx);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function regionOf(item: unknown, where: string): RedactRegion {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new ToolError(
      `${where} is not a rectangle.`,
      'Each region needs x, y, w and h numbers in percent.',
    );
  }
  const raw = item as Record<string, unknown>;
  const region: RedactRegion = {
    x: Number(raw.x),
    y: Number(raw.y),
    w: Number(raw.w),
    h: Number(raw.h),
  };
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h)
  ) {
    throw new ToolError(
      `${where} has a coordinate that is not a number.`,
      'Each region needs x, y, w and h numbers in percent.',
    );
  }
  return region;
}

/** Clamp a rectangle into `0..100`, keeping at least `MIN_REDACT_PERCENT` per side. */
export function clampRegion(region: RedactRegion): RedactRegion {
  const w = clamp(
    Number.isFinite(region.w) ? region.w : MIN_REDACT_PERCENT,
    MIN_REDACT_PERCENT,
    100,
  );
  const h = clamp(
    Number.isFinite(region.h) ? region.h : MIN_REDACT_PERCENT,
    MIN_REDACT_PERCENT,
    100,
  );
  const x = clamp(Number.isFinite(region.x) ? region.x : 0, 0, 100 - w);
  const y = clamp(Number.isFinite(region.y) ? region.y : 0, 0, 100 - h);
  return { x, y, w, h };
}

/**
 * Parse and validate the redaction plan against a document.
 *
 * The plan is a JSON array of `{ page, regions }` entries, where `regions` are
 * `{ x, y, w, h }` rectangles in percent of the page. Rejects — with a
 * `ToolError` — invalid JSON, a non-array, an entry without a page number, a
 * page outside the document, and a region that is not a rectangle. Entries with
 * no usable rectangles are dropped, so a stray empty entry can never flatten a
 * page to no purpose; two entries for the same page are merged.
 */
export function parseRedactPlan(raw: unknown, totalPages: number): RedactEntry[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new ToolError('This PDF has no pages to redact.');
  }
  const text = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!text || text === '[]') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ToolError(
      'The redaction plan is not valid JSON.',
      'It must be an array like [{"page":1,"regions":[{"x":10,"y":10,"w":20,"h":8}]}].',
    );
  }
  if (!Array.isArray(parsed)) {
    throw new ToolError('The redaction plan must be a JSON array of pages.');
  }

  const byPage = new Map<number, RedactRegion[]>();
  parsed.forEach((rawEntry, index) => {
    if (typeof rawEntry !== 'object' || rawEntry === null || Array.isArray(rawEntry)) {
      throw new ToolError(`Entry ${index + 1} of the redaction plan is not a page.`);
    }
    const entry = rawEntry as Record<string, unknown>;
    const page = Math.trunc(Number(entry.page));
    if (!Number.isInteger(page) || page < 1) {
      throw new ToolError(
        `Entry ${index + 1} of the redaction plan has no page number.`,
        'Each entry needs a whole "page" number.',
      );
    }
    if (page > totalPages) {
      throw new ToolError(
        `The redaction plan points at page ${page}, but this PDF has ${totalPages} pages.`,
        'Draw the rectangles on the page you want to cover.',
      );
    }
    if (entry.regions !== undefined && !Array.isArray(entry.regions)) {
      throw new ToolError(`Page ${page} of the redaction plan has no region list.`);
    }
    // Clamping guarantees every side is at least MIN_REDACT_PERCENT, so the
    // only reason to drop a page is that it carries no rectangles at all.
    const regions = (entry.regions ?? []).map((region, i) =>
      clampRegion(regionOf(region, `Page ${page}, region ${i + 1}`)),
    );
    if (!regions.length) return;
    byPage.set(page, [...(byPage.get(page) ?? []), ...regions]);
  });

  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, regions]) => ({ page, regions }));
}

/** Human-readable page list for the warnings: "1, 3 and 5". */
export function describePages(pages: number[]): string {
  if (!pages.length) return 'none';
  if (pages.length === 1) return String(pages[0]);
  return `${pages.slice(0, -1).join(', ')} and ${pages[pages.length - 1]}`;
}

/* -------------------------------------------------------------------------- */
/*  Run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  const bytes = new Uint8Array(await file.arrayBuffer());
  abort(input);

  const source = await loadPdfBytes(bytes);
  const total = source.getPageCount();
  const plan = parseRedactPlan(o.plan, total);
  if (!plan.length) {
    throw new ToolError(
      'Nothing to redact.',
      'Draw at least one rectangle over the content you want to destroy.',
    );
  }
  const scale = clamp(
    Number.isFinite(Number(o.scale)) ? Number(o.scale) : 2,
    MIN_REDACT_SCALE,
    MAX_REDACT_SCALE,
  );
  const redacted = new Set(plan.map((entry) => entry.page));

  if (typeof OffscreenCanvas === 'undefined') {
    throw new ToolError(
      'This browser cannot rasterise PDF pages in a worker.',
      'Try an up-to-date browser with OffscreenCanvas support.',
    );
  }

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/password/i.test(message))
      throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('This file is not a valid, readable PDF.');
  }

  input.onProgress?.(0.05, 'Preparing pages');
  const out = await PDFDocument.create();

  // Copy the pages that keep their text layer in one pass.
  const keepIndices: number[] = [];
  for (let page = 1; page <= total; page++) if (!redacted.has(page)) keepIndices.push(page - 1);
  const copied = keepIndices.length ? await out.copyPages(source, keepIndices) : [];
  const keepByPage = new Map<number, (typeof copied)[number]>();
  keepIndices.forEach((index, i) => keepByPage.set(index + 1, copied[i]!));

  try {
    let done = 0;
    for (let page = 1; page <= total; page++) {
      abort(input);
      const planEntry = plan.find((entry) => entry.page === page);
      if (!planEntry) {
        out.addPage(keepByPage.get(page)!);
        done += 1;
        input.onProgress?.(done / total, `Kept page ${page}`);
        continue;
      }

      const pdfPage = await pdf.getPage(page);
      const rotation = pdfPage.rotate || 0;
      const viewport = pdfPage.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) throw new ToolError('Could not create a canvas for the redacted page.');
      await pdfPage.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      pdfPage.cleanup();

      // Burn every box in opaque black — the underlying pixels are overwritten,
      // so the content is gone rather than merely covered.
      context.fillStyle = 'rgb(0, 0, 0)';
      for (const region of planEntry.regions) {
        const rect = regionToPixels(region, width, height);
        if (rect) context.fillRect(rect.x, rect.y, rect.w, rect.h);
      }

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const png = await out.embedPng(new Uint8Array(await blob.arrayBuffer()));
      const media = source.getPage(page - 1).getSize();
      const pageSize = pagePixelSize(media.width, media.height, rotation, 1);
      const outPage = out.addPage([pageSize.width, pageSize.height]);
      outPage.drawImage(png, {
        x: 0,
        y: 0,
        width: pageSize.width,
        height: pageSize.height,
      });
      done += 1;
      input.onProgress?.(done / total, `Redacted page ${page}`);
    }
  } finally {
    await pdf.destroy();
  }

  abort(input);
  const saved = await out.save();
  const result = output(String(o.outputName || 'redacted.pdf'), saved);
  result.stats = {
    pages: total,
    redactedPages: plan.length,
    textPagesKept: total - plan.length,
    bytes: saved.length,
  };
  const pages = plan.map((entry) => entry.page);
  result.warnings = [
    `Pages ${describePages(pages)} were flattened to images and their text layer is gone — the text on those pages can no longer be selected, copied or searched.`,
    'The original content under the black boxes is destroyed, not merely covered. Keep a copy of the original file if you may need it.',
  ];
  if (total - plan.length > 0) {
    result.notes = [
      `Pages ${describePages(
        Array.from({ length: total }, (_, i) => i + 1).filter((page) => !redacted.has(page)),
      )} kept their original text and are still searchable.`,
    ];
  } else {
    result.notes = ['Every page was rasterised — the whole document lost its text layer.'];
  }
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
