import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { unzip } from 'fflate';
import { meta } from './zip-extract.meta';

interface ZipCentralEntry {
  path: string;
  encrypted: boolean;
}

/** Read the central directory to detect encryption and, if safe, delegate the rest to unzip. */
function parseCentralDirectory(bytes: Uint8Array): ZipCentralEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new ToolError(
      'Could not find the ZIP central directory.',
      'The file is not a valid ZIP archive.',
    );
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipCentralEntry[] = [];
  for (let i = 0; i < count && offset + 46 <= bytes.length; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const flags = view.getUint16(offset + 8, true);
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
    entries.push({ path, encrypted: (flags & 0x0001) !== 0 });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose a ZIP file.');
  const rows: string[][] = [];
  const outputs: FileRunResult['outputs'] = [];
  for (const file of files) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const raw = new Uint8Array(await file.arrayBuffer());
    const directory = parseCentralDirectory(raw);
    if (directory.some((e) => e.encrypted)) {
      throw new ToolError(
        'This ZIP uses encryption, which is not supported.',
        'Encrypted archives must be unzipped with password-aware software.',
      );
    }
    let entries: Record<string, Uint8Array>;
    try {
      entries = await new Promise((resolve, reject) => {
        unzip(raw, (err, data) => (err ? reject(err) : resolve(data)));
      });
    } catch {
      throw new ToolError(
        'Could not read this ZIP archive.',
        'The file may be invalid or use an unsupported compression method.',
      );
    }
    const list = Object.entries(entries);
    let n = 0;
    for (const [path, bytes] of list) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const normalized = path.replace(/\\/g, '/');
      const segments = normalized.split('/');
      const safe =
        normalized &&
        !normalized.startsWith('/') &&
        !/^[A-Za-z]:/.test(normalized) &&
        segments.every((part) => part && part !== '.' && part !== '..')
          ? normalized
          : '';
      const selected = !String(o.filter) || path.includes(String(o.filter));
      const available = n < 200;
      if (selected && safe && available) {
        outputs.push({
          filename: safe.replace(/\//g, '__'),
          blob: new Blob([bytes.slice().buffer as ArrayBuffer]),
        });
        n++;
      }
      rows.push([
        path,
        String(bytes.length),
        selected && safe ? (available ? 'extracted' : 'skipped (limit)') : 'skipped',
      ]);
    }
    onProgress?.(1, 'ZIP entries processed');
  }
  return {
    outputs,
    report: {
      output: JSON.stringify({ headers: ['Path', 'Size', 'Status'], rows }),
      render: 'table',
    },
    notes:
      rows.length > 200 ? ['Extraction is limited to the first 200 matching entries.'] : undefined,
    stats: { entries: rows.length, extracted: outputs.length },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;
