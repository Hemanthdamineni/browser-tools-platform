import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { meta } from './zip-inspect.meta';

const EOCD = 0x06054b50;

interface ZipEntry {
  path: string;
  method: number;
  crc32: number;
  compressed: number;
  uncompressed: number;
  dosageTime: number;
  dosageDate: number;
}

function parseCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Find the End of Central Directory record (scan backwards from the end).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ToolError('Could not find the ZIP central directory.', 'The file is not a valid ZIP archive.');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset >= bytes.length) throw new ToolError('The ZIP central directory is out of bounds.', 'The file may be truncated or a multi-part archive, which is unsupported.');
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const crc32 = view.getUint32(offset + 16, true) >>> 0;
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLen);
    let path: string;
    try {
      path = new TextDecoder().decode(nameBytes);
    } catch {
      path = String.fromCharCode(...nameBytes);
    }
    entries.push({ path, method, crc32, compressed, uncompressed, dosageTime: view.getUint16(offset + 12, true), dosageDate: view.getUint16(offset + 14, true) });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function dosDateTime(time: number, date: number): string {
  if (!time && !date) return '—';
  const hour = (time >> 11) & 0x1f;
  const minute = (time >> 5) & 0x3f;
  const second = (time & 0x1f) * 2;
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  if (!year || !month || !day) return '—';
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? '—' : iso;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose a ZIP file.');
  onProgress?.(0, 'Reading');
  const bytes = files[0]!.size === 0 ? new Uint8Array() : new Uint8Array(await files[0]!.arrayBuffer());
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const entries = parseCentralDirectory(bytes);
  if (!entries.length) throw new ToolError('No ZIP entries found.');
  const rows: string[][] = [];
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    const ratio = e.uncompressed ? (1 - e.compressed / e.uncompressed) : 0;
    rows.push([
      e.path,
      formatBytes(e.uncompressed),
      formatBytes(e.compressed),
      `${(ratio * 100).toFixed(1)}%`,
      e.crc32.toString(16).padStart(8, '0'),
      dosDateTime(e.dosageTime, e.dosageDate),
    ]);
    totalIn += e.uncompressed;
    totalOut += e.compressed;
  }
  onProgress?.(1, 'Done');
  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Path', 'Size', 'Compressed', 'Ratio', 'CRC32', 'Modified'], rows }), render: 'table' },
    stats: { entries: entries.length, inputBytes: totalIn, outputBytes: totalOut, ratio: totalIn ? 1 - totalOut / totalIn : 0 },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;