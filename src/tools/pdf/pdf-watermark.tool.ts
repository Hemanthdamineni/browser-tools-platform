import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { degrees, rgb, StandardFonts } from 'pdf-lib';
import { abort, firstFile, loadPdf, output, parsePages, resolve } from './shared';
import { meta } from './pdf-watermark.meta';

function parseColor(value: unknown) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? ''));
  if (!match) throw new ToolError('Enter a valid six-digit hex colour, such as #ff0000.');
  const n = parseInt(match[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  const text = String(o.text ?? '').trim();
  if (!text) throw new ToolError('Enter watermark text.');
  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  const total = doc.getPageCount();
  abort(input);
  const selection = parsePages(o.pages, total);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = parseColor(o.color);
  const size = Math.max(1, Number(o.fontSize) || 48);
  const rotation = Math.max(-90, Math.min(90, Number(o.rotation) || 0));
  const opacity = Math.max(0.05, Math.min(1, Number(o.opacity) / 100 || 0.15));
  const widthText = font.widthOfTextAtSize(text, size);

  for (let i = 0; i < selection.length; i++) {
    const pageNumber = selection[i]!;
    const page = doc.getPage(pageNumber - 1)!;
    const { width, height } = page.getSize();
    const draw = (x: number, y: number) => page.drawText(text, { x, y, size, font, color, rotate: degrees(rotation), opacity });
    if (o.position === 'tile') {
      const stepX = Math.max(widthText + 35, 90);
      const stepY = Math.max(size * 3, 80);
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) draw(x, y);
      }
    } else {
      draw((width - widthText) / 2, (height - size) / 2);
    }
    input.onProgress?.((i + 1) / selection.length, `Watermarked page ${pageNumber}`);
  }

  const bytes = await doc.save();
  const result = output('watermarked.pdf', bytes);
  result.stats = { pages: total, watermarked: selection.length };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
