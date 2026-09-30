import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { zipSync } from 'fflate';
import { PDFDocument, abort, loadPdf, firstFile, output, resolve } from './shared';
import { meta } from './pdf-split.meta';

async function build(source: PDFDocument, groups: number[][]): Promise<{ name: string; bytes: Uint8Array }[]> {
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, groups[i]!.map((p) => p - 1));
    pages.forEach((page) => doc.addPage(page));
    files.push({ name: `part-${String(i + 1).padStart(2, '0')}.pdf`, bytes: await doc.save() });
  }
  return files;
}

function rangeGroups(value: unknown, total: number): number[][] {
  const text = String(value ?? '').trim();
  if (!text) throw new ToolError('Enter at least one range, such as 1-3,5.');
  const groups: number[][] = [];
  for (const part of text.split(',')) {
    const token = part.trim();
    const match = /^(\d+)(?:\s*-\s*(\d*)?)?$/.exec(token);
    if (!match) throw new ToolError('Enter ranges as 1-3,5,7- .');
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : match[2] === '' ? total : Number(match[2]);
    if (start < 1 || end < start || end > total) throw new ToolError(`Range "${token}" is outside this PDF (1–${total}).`);
    const group: number[] = [];
    for (let p = start; p <= end; p++) group.push(p);
    groups.push(group);
  }
  if (!groups.length) throw new ToolError('Enter at least one range.');
  return groups;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  const mode = String(o.mode || 'every-page');
  onProgressSafe(input, 0, 'Reading PDF');
  const source = await loadPdf(file);
  const total = source.getPageCount();
  abort(input);

  let groups: number[][];
  if (mode === 'ranges') {
    groups = rangeGroups(o.ranges, total);
  } else if (mode === 'fixed-size') {
    const size = Math.max(1, Math.floor(Number(o.size) || 10));
    groups = [];
    for (let start = 1; start <= total; start += size) {
      const group: number[] = [];
      for (let p = start; p < start + size && p <= total; p++) group.push(p);
      groups.push(group);
    }
  } else {
    groups = [];
    for (let p = 1; p <= total; p++) groups.push([p]);
  }

  const files = await build(source, groups);
  const stats = { pages: total, outputs: files.length };
  if (files.length === 1) {
    const result = output('split.pdf', files[0]!.bytes);
    result.stats = stats;
    return result;
  }
  const entries: Record<string, Uint8Array> = {};
  files.forEach((f) => { entries[f.name] = f.bytes; });
  const zip = zipSync(entries, { level: 6 });
  const result = output('split.zip', zip, 'application/zip');
  result.stats = { ...stats, bytes: zip.length };
  return result;
}

function onProgressSafe(input: FileRunInput, fraction: number, message: string) {
  input.onProgress?.(fraction, message);
}

const tool: FileToolModule = { meta, run };
export default tool;
