import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { rgb, StandardFonts } from 'pdf-lib';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import { meta } from './pdf-page-numbers.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  const total = doc.getPageCount();
  abort(input);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const position = String(o.position || 'bottom-center');
  const format = String(o.format || 'n');
  const fontSize = Math.max(1, Number(o.fontSize) || 10);
  const margin = Math.max(0, Number(o.margin) || 24);
  const startAt = Math.max(1, Math.floor(Number(o.startAt) || 1));

  let numbered = 0;
  for (let i = 0; i < total; i++) {
    if (i === 0 && o.skipFirst) continue;
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const n = startAt + i - (o.skipFirst ? 1 : 0);
    const label =
      format === 'n'
        ? String(n)
        : format === 'n-of-total'
          ? `${n} of ${total}`
          : format === 'page-n'
            ? `Page ${n}`
            : `Page ${n} of ${total}`;
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const horizontal = position.endsWith('center')
      ? 'center'
      : position.endsWith('left')
        ? 'left'
        : 'right';
    const x =
      horizontal === 'left'
        ? margin
        : horizontal === 'right'
          ? width - margin - textWidth
          : (width - textWidth) / 2;
    const y = position.startsWith('top') ? height - margin - fontSize : margin;
    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    numbered++;
    input.onProgress?.((i + 1) / total, `Numbered page ${i + 1}`);
  }

  const bytes = await doc.save();
  const result = output('numbered.pdf', bytes);
  result.stats = { pages: total, numbered };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
