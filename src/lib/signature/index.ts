/**
 * The shared signature module.
 *
 * `pdf-sign` and the (planned) signature maker both use this: it turns a
 * drawn, typed or uploaded signature into a transparent PNG data URL that can
 * be placed on a page or exported.
 *
 * Import the pure helpers from `./pixels` directly when you need them inside a
 * Web Worker — this barrel pulls in the browser-only modules.
 */
export type { SignatureAsset, SignatureMode, SignatureStyle } from './types';
export { SIGNATURE_CHANGE_EVENT } from './types';
export {
  bytesToDataUrl,
  decodeDataUrl,
  isPngBytes,
  readPngInfo,
  trimAlpha,
  type DecodedDataUrl,
  type PixelRect,
  type PngInfo,
} from './pixels';
export { cropToInk, fitWithin, get2d, type InkBox } from './canvas';
export { createSignaturePad, PAD_HEIGHT, PAD_WIDTH, type SignaturePad } from './draw';
export {
  renderTypedSignature,
  signatureStyle,
  SIGNATURE_COLORS,
  SIGNATURE_STYLES,
  type SignatureStyleSpec,
  type TypedSignatureOptions,
} from './typed';
export { MAX_SIGNATURE_BYTES, MAX_SIGNATURE_EDGE, readUploadedSignature } from './upload';
