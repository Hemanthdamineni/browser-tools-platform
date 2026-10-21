/**
 * Uploaded signatures: a PNG the user supplies (typically exported from a
 * scanner or another signature tool).
 *
 * PNG is the only accepted format: it is the one that keeps an alpha
 * channel, and it is the format `pdf-lib` can embed without conversion.
 */
import { get2d, fitWithin } from './canvas';
import { readPngInfo } from './pixels';
import type { SignatureAsset } from './types';

/** Hard limit for an uploaded signature file. */
export const MAX_SIGNATURE_BYTES = 8 * 1024 * 1024;
/** Longest edge of the embedded copy — bigger uploads are scaled down. */
export const MAX_SIGNATURE_EDGE = 1600;

/**
 * Read an uploaded PNG into a signature asset.
 *
 * The image is re-encoded through a canvas so the result is a normalised PNG
 * data URL that is also small enough to embed in a PDF.
 */
export async function readUploadedSignature(file: File): Promise<SignatureAsset> {
  if (!file.size) throw new Error('That file is empty.');
  if (file.size > MAX_SIGNATURE_BYTES) throw new Error('That image is larger than 8 MB.');
  const looksPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  if (!looksPng) {
    throw new Error('Upload a PNG image — transparency is what keeps the signature clean.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readPngInfo(bytes);
  if (!info) throw new Error('That file is not a valid PNG image.');
  if (info.width * info.height > 64_000_000) {
    throw new Error('That image is too large (64 megapixels at most).');
  }

  const decoded = await decodeImageElement(file);
  const target = fitWithin(decoded.width, decoded.height, MAX_SIGNATURE_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = get2d(canvas);
  ctx.drawImage(decoded.source, 0, 0, target.width, target.height);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: target.width,
    height: target.height,
    mode: 'upload',
    hasAlpha: info.hasAlpha,
  };
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** Decode a file into something `drawImage()` accepts. */
async function decodeImageElement(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      /* fall through to the <img> decoder */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    throw new Error('That image could not be decoded.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
