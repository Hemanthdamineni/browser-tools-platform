import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import { meta } from './pdf-metadata.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF metadata');
  const doc = await loadPdf(file);
  abort(input);
  const current = [
    ['Title', doc.getTitle() ?? ''],
    ['Author', doc.getAuthor() ?? ''],
    ['Subject', doc.getSubject() ?? ''],
    ['Keywords', doc.getKeywords() ?? ''],
    ['Creator', doc.getCreator() ?? ''],
    ['Producer', doc.getProducer() ?? ''],
    ['Creation Date', doc.getCreationDate()?.toISOString() ?? ''],
    ['Modification Date', doc.getModificationDate()?.toISOString() ?? ''],
    ['Page Count', String(doc.getPageCount())],
  ];
  const edited =
    Boolean(o.clearAll) ||
    ['title', 'author', 'subject', 'keywords', 'creator', 'producer'].some(
      (key) => String(o[key] ?? '').trim() !== '',
    );
  const report = {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows: current }),
    render: 'table' as const,
  };
  if (!edited) return { outputs: [], report, stats: { pages: doc.getPageCount() } };

  doc.setTitle(o.clearAll ? '' : String(o.title ?? ''));
  doc.setAuthor(o.clearAll ? '' : String(o.author ?? ''));
  doc.setSubject(o.clearAll ? '' : String(o.subject ?? ''));
  doc.setKeywords(
    o.clearAll
      ? []
      : String(o.keywords ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
  );
  doc.setCreator(o.clearAll ? '' : String(o.creator ?? ''));
  doc.setProducer(o.clearAll ? '' : String(o.producer ?? ''));
  const bytes = await doc.save();
  const result = output('metadata-updated.pdf', bytes);
  result.report = report;
  result.stats = { pages: doc.getPageCount(), bytes: bytes.length };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
