import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { PDFDocument, abort, output, resolve } from './shared';
import { meta } from './images-to-pdf.meta';

const PAPER: Record<string, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolve(input, meta);
  const files = input.files ?? [];
  if (!files.length) throw new ToolError('Choose at least one PNG or JPEG image.');

  const doc = await PDFDocument.create();
  const pageSize = String(options.pageSize || 'fit');
  const orientation = String(options.orientation || 'auto');
  const fitMode = String(options.fitMode || 'contain');
  const margin = Math.max(0, Number(options.margin) || 0);
  if (pageSize !== 'fit' && !PAPER[pageSize]) throw new ToolError('Choose Fit to image, A4, or Letter page size.');
  if (fitMode !== 'contain' && fitMode !== 'cover') throw new ToolError('Choose contain or cover image fitting.');

  input.onProgress?.(0, 'Preparing PDF');
  for (let i = 0; i < files.length; i++) {
    abort(input);
    const file = files[i]!;
    let image;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === 'image/png' || /\.png$/i.test(file.name)) image = await doc.embedPng(bytes);
      else if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) image = await doc.embedJpg(bytes);
      else throw new ToolError(`"${file.name}" is not a supported PNG or JPEG image.`);
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(`"${file.name}" is not a valid PNG or JPEG image.`);
    }

    let width = image.width;
    let height = image.height;
    if (pageSize !== 'fit') {
      const paper = PAPER[pageSize]!;
      const landscape = orientation === 'landscape' || (orientation === 'auto' && image.width > image.height);
      const pageWidth = landscape ? paper.height : paper.width;
      const pageHeight = landscape ? paper.width : paper.height;
      const areaWidth = Math.max(1, pageWidth - margin * 2);
      const areaHeight = Math.max(1, pageHeight - margin * 2);
      const scale = fitMode === 'contain'
        ? Math.min(areaWidth / image.width, areaHeight / image.height)
        : Math.max(areaWidth / image.width, areaHeight / image.height);
      width = image.width * scale;
      height = image.height * scale;
      const page = doc.addPage([pageWidth, pageHeight]);
      page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    } else {
      const page = doc.addPage([width, height]);
      page.drawImage(image, { x: 0, y: 0, width, height });
    }
    input.onProgress?.((i + 1) / files.length, `Added ${file.name}`);
  }

  abort(input);
  const bytes = await doc.save();
  const result = output('images.pdf', bytes);
  result.stats = { images: files.length, pages: doc.getPageCount(), bytes: bytes.length };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
