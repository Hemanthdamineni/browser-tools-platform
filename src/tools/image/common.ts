import { ToolError } from '@/lib/types';
import { decodeImage, drawToBlob } from '@/lib/image';

export function checkFiles(files: File[], multiple = false): void {
  if (!files.length) throw new ToolError('Choose an image file.');
  if (!multiple && files.length !== 1) throw new ToolError('Choose exactly one image file.');
  if (files.some((f) => !f.type.startsWith('image/'))) {
    throw new ToolError('The selected file is not an image.');
  }
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

export function stem(name: string): string {
  return name.replace(/\.[^.]*$/, '') || 'image';
}

export function outputMime(format: unknown, source: string): string {
  const f = String(format ?? 'original');
  if (f === 'original' || f === 'auto') return source.startsWith('image/') ? source : 'image/png';
  if (f === 'jpeg' || f === 'jpg') return 'image/jpeg';
  if (f.startsWith('image/')) return f;
  return `image/${f}`;
}

export function extension(mime: string): string {
  return mime === 'image/jpeg'
    ? 'jpg'
    : mime === 'image/svg+xml'
      ? 'svg'
      : (mime.split('/')[1] ?? 'png');
}

export async function decode(file: File) {
  if (!file.type.startsWith('image/')) throw new ToolError('The selected file is not an image.');
  return decodeImage(file);
}

export async function encode(
  source: ImageBitmap | OffscreenCanvas,
  mime: string,
  quality?: number,
): Promise<Blob> {
  const blob = await drawToBlob(source, { type: mime, quality });
  if (blob.type !== mime)
    throw new ToolError(
      `This browser cannot encode ${mime.replace('image/', '')}.`,
      'Try WebP or PNG.',
    );
  return blob;
}

export function parseHexColor(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const s = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
