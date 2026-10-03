import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { degrees } from 'pdf-lib';
import { abort, firstFile, loadPdf, output, parsePages, resolve } from './shared';
import { meta } from './pdf-rotate.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  const total = doc.getPageCount();
  abort(input);
  const selection = parsePages(o.pages, total);
  const angle = Number(o.angle) || 90;
  if (![90, 180, 270].includes(angle))
    throw new ToolError('Rotation must be 90, 180, or 270 degrees.');

  const pages = doc.getPages();
  let rotated = 0;
  for (const pageNumber of selection) {
    const page = pages[pageNumber - 1]!;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
    rotated++;
    input.onProgress?.(rotated / selection.length, `Rotated page ${pageNumber}`);
  }

  const bytes = await doc.save();
  const result = output('rotated.pdf', bytes);
  result.stats = { pages: total, rotated };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
