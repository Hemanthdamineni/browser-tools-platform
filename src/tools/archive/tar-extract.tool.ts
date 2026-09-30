import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { gunzipSync } from 'fflate';
import { meta } from './tar-extract.meta';

const BLOCK = 512;
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}
function safeName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || parts.some((part) => !part || part === '.' || part === '..')) return '';
  return normalized;
}
async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose a TAR file.');
  const raw = new Uint8Array(await files[0]!.arrayBuffer());
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  let bytes = raw;
  if (isGzip(raw)) {
    try { bytes = gunzipSync(raw); } catch { throw new ToolError('Could not decompress this TAR.', 'The gzip wrapper is invalid.'); }
  }
  const rows: string[][] = [];
  const outputs: FileRunResult['outputs'] = [];
  let offset = 0;
  let count = 0;
  while (offset + BLOCK <= bytes.length) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const header = bytes.subarray(offset, offset + BLOCK);
    // End of archive: two zero blocks.
    if (!header.some((b) => b !== 0)) break;
    const nameField = new TextDecoder().decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    if (!nameField) break;
    const sizeOctal = new TextDecoder().decode(header.subarray(124, 136)).replace(/[ \0]/g, '');
    const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;
    if (!Number.isFinite(size) || size < 0 || offset + BLOCK + size > bytes.length) throw new ToolError('Invalid TAR archive.', 'A header declares an out-of-bounds file size.');
    const typeflag = String.fromCharCode(header[156] ?? 0x30);
    const name = safeName(nameField);
    const dataStart = offset + BLOCK;
    const isRegular = typeflag === '0' || typeflag === '\0' || typeflag === '';
    if (isRegular && name) {
      const data = bytes.subarray(dataStart, dataStart + size);
      outputs.push({ filename: name.replace(/\//g, '__'), blob: new Blob([data]) });
      rows.push([name, String(size), 'extracted']);
      count++;
    } else {
      rows.push([nameField, String(size), 'skipped']);
    }
    const advance = BLOCK + size + (BLOCK - (size % BLOCK)) % BLOCK;
    offset += advance;
  }
  if (!count && !rows.length) throw new ToolError('Not a TAR archive.', 'No ustar header blocks were found.');
  onProgress?.(1, 'Done');
  return { outputs, report: { output: JSON.stringify({ headers: ['Path', 'Size', 'Status'], rows }), render: 'table' }, stats: { entries: rows.length, extracted: count } };
}
const tool: FileToolModule = { meta, run };
export default tool;