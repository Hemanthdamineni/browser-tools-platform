/**
 * SVG safety helpers for the rasterising image tools.
 *
 * Rasterising an SVG through `createImageBitmap` *should* never run scripts or
 * fetch sub-resources — the browser treats the file as an image, not a document.
 * We do not rely on that alone: an SVG can still carry `<script>`, event
 * handlers, external `<image href>` / CSS `url()` references, `@import`s and an
 * external DTD. This module rejects those constructs with a friendly
 * `ToolError` before the bytes are ever handed to the decoder, so a malicious
 * "SVG" cannot trigger a network request or execute script in the page.
 *
 * It also normalises the root `<svg>` to an explicit pixel size so
 * `createImageBitmap` rasterises at a predictable resolution (some engines give
 * a viewBox-only SVG an arbitrary intrinsic size).
 */
import { ToolError } from '@/lib/types';

/** Elements that are out of scope for a rasteriser and can carry active content. */
const FORBIDDEN_ELEMENTS = /<\s*(script|foreignObject|iframe|embed|object|audio|video)\b/i;
/** Inline event handlers such as `onclick=` / `onload=`. */
const EVENT_HANDLER = /\son[a-z]+\s*=/i;
/** A DTD that points at an external resource (XXE / network fetch). */
const EXTERNAL_DTD = /<!DOCTYPE[^>]*(SYSTEM|PUBLIC)/i;
/** `href`, `xlink:href` or `src` attributes. */
const REFERENCE_ATTR = /\b(?:xlink:href|href|src)\s*=\s*(["'])(.*?)\1/gi;
/** `url(...)` used from an inline style or presentation attribute. */
const CSS_URL = /url\(\s*(["']?)(.*?)\1\s*\)/gi;

/** A reference is safe when it stays inside the document or is an inline data URL. */
export function isSafeReference(raw: string | undefined): boolean {
  const value = (raw ?? '').trim();
  if (!value) return true;
  if (value.startsWith('#')) return true;
  if (/^data:/i.test(value)) return true;
  return false;
}

/**
 * Throw a `ToolError` when `text` contains anything that could fetch a remote
 * resource or execute script. Pure and exported so it can be unit-tested.
 */
export function assertSafeSvg(text: string): void {
  if (FORBIDDEN_ELEMENTS.test(text)) {
    throw new ToolError(
      'This SVG contains elements that cannot be rasterised safely.',
      'Remove <script>, <foreignObject> and other embedded media, then try again.',
    );
  }
  if (EVENT_HANDLER.test(text)) {
    throw new ToolError(
      'This SVG contains inline event handlers, which are not allowed.',
      'Remove the on* attributes and try again.',
    );
  }
  if (EXTERNAL_DTD.test(text)) {
    throw new ToolError(
      'This SVG references an external document type definition, which is blocked.',
      'Remove the DOCTYPE declaration and try again.',
    );
  }
  for (const match of text.matchAll(REFERENCE_ATTR)) {
    if (!isSafeReference(match[2])) {
      throw new ToolError(
        'This SVG references an external resource, which is blocked for your privacy.',
        'Inline the resource as a data: URL, or remove the reference.',
      );
    }
  }
  if (/@import/i.test(text)) {
    throw new ToolError(
      'This SVG imports an external stylesheet, which is blocked for your privacy.',
      'Inline the styles and try again.',
    );
  }
  for (const match of text.matchAll(CSS_URL)) {
    if (!isSafeReference(match[2])) {
      throw new ToolError(
        'This SVG references an external resource from CSS, which is blocked for your privacy.',
        'Inline the resource as a data: URL, or remove the reference.',
      );
    }
  }
}

/**
 * Ensure the root `<svg>` carries explicit pixel `width`/`height` so the decoder
 * rasterises at a known size. Any existing width/height (including percentage
 * values) is replaced; viewBox and everything else are left untouched.
 */
export function normalizeSvgSize(text: string, width: number, height: number): string {
  const match = /<svg\b[^>]*>/i.exec(text);
  if (!match) return text;
  const tag = match[0]
    .replace(/\swidth\s*=\s*(["']).*?\1/gi, '')
    .replace(/\sheight\s*=\s*(["']).*?\1/gi, '')
    .replace(/^<svg\b/i, `<svg width="${width}" height="${height}"`);
  return text.slice(0, match.index) + tag + text.slice(match.index + match[0].length);
}
