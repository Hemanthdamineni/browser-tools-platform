import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { gzipSync } from 'fflate';
import { meta } from './tar-create.meta';

const BLOCK = 512;

function octal(value: number, field: number): string {
  const s = value.toString(8).padStart(field - 1, '0') + '\0';
  return s.slice(0, field);
}

/**
 * Encode a ustar numeric field. `size` and `mtime` are 12 bytes wide (11 octal
 * digits + NUL); values too large for octal fall back to the base-256 encoding
 * POSIX defines (leading 0x80 byte, remaining bytes big-endian).
 */
function numericField(value: number, field: number): Uint8Array {
  const max = Math.pow(8, field - 1) - 1;
  if (value <= max) return new TextEncoder().encode(octal(value, field));
  const out = new Uint8Array(field);
  out[0] = 0x80;
  let v = Math.max(0, Math.floor(value));
  for (let i = field - 1; i >= 1; i--) {
    out[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  if (v > 0) out.fill(0xff); // saturate values too large for the field
  return out;
}

function header(name: string, size: number, mtime: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name.slice(0, 99));
  block.set(nameBytes, 0);
  const fields: [number, string, number][] = [
    [100, '0000644\0', 8],
    [108, '0000000\0', 8],
    [116, '0000000\0', 8],
    [148, '        ', 8], // 8 spaces, per spec, replaced with the checksum below
  ];
  for (const [off, val, len] of fields) block.set(enc.encode(val.slice(0, len)), off);
  block.set(numericField(size, 12), 124);
  block.set(numericField(mtime, 12), 136);
  block[156] = 0x30; // typeflag '0' (regular file)
  block.set(enc.encode('ustar\0'), 257);
  block.set(enc.encode('00'), 263);
  // checksum
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += block[i]!;
  const chk = sum.toString(8).padStart(6, '0') + '\0 ';
  block.set(enc.encode(chk), 148);
  return block;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose at least one file.');
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const f = files[i]!;
    const name = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
    if (
      !name ||
      name.startsWith('/') ||
      /^[A-Za-z]:/.test(name) ||
      name.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      throw new ToolError(
        'Invalid archive path.',
        'Archive entry paths must be relative and cannot contain empty, dot or traversal segments.',
      );
    }
    const data = new Uint8Array(await f.arrayBuffer());
    total += data.length;
    // File.lastModified is epoch milliseconds; TAR stores whole seconds.
    const mtime = Math.max(0, Math.floor((f.lastModified || Date.now()) / 1000));
    parts.push(header(name, data.length, mtime));
    parts.push(data);
    const pad = BLOCK - (data.length % BLOCK);
    if (pad !== BLOCK) parts.push(new Uint8Array(pad));
    onProgress?.((i + 1) / files.length, `Adding ${f.name}`);
  }
  parts.push(new Uint8Array(BLOCK * 2));
  const len = parts.reduce((a, p) => a + p.length, 0);
  const tar = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    tar.set(p, off);
    off += p.length;
  }
  let filename = String(o.tarName || 'archive.tar');
  let outBlob: Blob;
  let outBytes = tar;
  if (o.gzip) {
    outBytes = gzipSync(tar);
    if (/\.tar$/i.test(filename)) filename += '.gz';
    else if (!/\.tar\.gz$/i.test(filename))
      filename = filename.replace(/\.[^./\\]+$/, '') + '.tar.gz';
    outBlob = new Blob([outBytes], { type: 'application/gzip' });
  } else {
    outBlob = new Blob([tar], { type: 'application/x-tar' });
  }
  return {
    outputs: [{ filename, blob: outBlob }],
    stats: {
      files: files.length,
      inputBytes: total,
      outputBytes: outBytes.length,
      ratio: total ? outBytes.length / total : 0,
    },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;
