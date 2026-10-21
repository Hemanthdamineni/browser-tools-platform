/**
 * Shared types for the signature capture module.
 *
 * The module is intentionally browser-agnostic: `pixels.ts` is pure maths (no
 * DOM) so it can be unit-tested in Node, while `canvas.ts` / `draw.ts` /
 * `typed.ts` / `upload.ts` use the DOM APIs a browser provides.
 *
 * Every signature ends up as a PNG **data URL** with an alpha channel, so the
 * same asset can be dropped onto a PDF page, exported as a PNG, or reused by
 * another tool (e.g. the signature maker) without further conversion.
 */

/** How a signature was produced. */
export type SignatureMode = 'draw' | 'type' | 'upload';

/** The type styles offered by the typed-signature mode. */
export type SignatureStyle = 'script' | 'classic' | 'modern' | 'mono';

/**
 * A signature ready to be placed somewhere.
 *
 * `dataUrl` is a `data:image/png;base64,…` URL — the PNG keeps its alpha
 * channel, so the ink stays transparent where the user did not draw.
 */
export interface SignatureAsset {
  /** PNG data URL (base64 encoded). */
  dataUrl: string;
  /** Intrinsic pixel width of the PNG. */
  width: number;
  /** Intrinsic pixel height of the PNG. */
  height: number;
  /** Which source produced it. */
  mode: SignatureMode;
  /** False when the source PNG has no alpha channel (fully opaque pixels). */
  hasAlpha: boolean;
}

/** The event a capture UI dispatches when the user creates or clears a signature. */
export const SIGNATURE_CHANGE_EVENT = 'signaturechange';
