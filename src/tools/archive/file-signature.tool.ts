import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './file-signature.meta';

type Match = { format: string; mime: string; extensions: string[]; confidence: string };
type Signature = Match & { offset: number; bytes: number[]; mask?: number[] };

const SIGNATURES: Signature[] = [
  { format: 'PNG image', mime: 'image/png', extensions: ['png'], confidence: 'strong', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: 'JPEG image', mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], confidence: 'strong', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { format: 'GIF image', mime: 'image/gif', extensions: ['gif'], confidence: 'strong', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], mask: [255, 255, 255, 255] },
  { format: 'RIFF container', mime: 'application/octet-stream', extensions: [], confidence: 'container', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { format: 'PDF document', mime: 'application/pdf', extensions: ['pdf'], confidence: 'strong', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { format: 'ZIP archive or ZIP-based container', mime: 'application/zip', extensions: ['zip'], confidence: 'strong', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { format: 'Empty ZIP archive', mime: 'application/zip', extensions: ['zip'], confidence: 'strong', offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
  { format: 'GZIP archive', mime: 'application/gzip', extensions: ['gz', 'gzip'], confidence: 'strong', offset: 0, bytes: [0x1f, 0x8b] },
  { format: '7-Zip archive', mime: 'application/x-7z-compressed', extensions: ['7z'], confidence: 'strong', offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { format: 'RAR archive', mime: 'application/vnd.rar', extensions: ['rar'], confidence: 'strong', offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { format: 'OLE compound document (legacy Office or MSI)', mime: 'application/x-ole-storage', extensions: ['doc', 'xls', 'ppt', 'msi'], confidence: 'container', offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { format: 'SQLite database', mime: 'application/vnd.sqlite3', extensions: ['sqlite', 'sqlite3', 'db'], confidence: 'strong', offset: 0, bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00] },
  { format: 'WASM module', mime: 'application/wasm', extensions: ['wasm'], confidence: 'strong', offset: 0, bytes: [0x00, 0x61, 0x73, 0x6d] },
  { format: 'ELF executable or shared object', mime: 'application/x-elf', extensions: ['elf', 'so'], confidence: 'strong', offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { format: 'Windows PE executable or DLL', mime: 'application/vnd.microsoft.portable-executable', extensions: ['exe', 'dll'], confidence: 'partial', offset: 0, bytes: [0x4d, 0x5a] },
  { format: 'MP3 audio (ID3)', mime: 'audio/mpeg', extensions: ['mp3'], confidence: 'strong', offset: 0, bytes: [0x49, 0x44, 0x33] },
  { format: 'FLAC audio', mime: 'audio/flac', extensions: ['flac'], confidence: 'strong', offset: 0, bytes: [0x66, 0x4c, 0x61, 0x43] },
  { format: 'Ogg container', mime: 'application/ogg', extensions: ['ogg', 'oga', 'ogv'], confidence: 'container', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { format: 'MP4-family media container', mime: 'video/mp4', extensions: ['mp4', 'm4a', 'm4v', 'mov'], confidence: 'container', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { format: 'WAV audio', mime: 'audio/wav', extensions: ['wav'], confidence: 'strong', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { format: 'WAV audio', mime: 'audio/wav', extensions: ['wav'], confidence: 'strong', offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] },
  { format: 'MP3 audio frame', mime: 'audio/mpeg', extensions: ['mp3'], confidence: 'partial', offset: 0, bytes: [0xff, 0xe0], mask: [0xff, 0xe0] },
];

function matchSignature(bytes: Uint8Array, signature: Signature): boolean {
  if (bytes.length < signature.offset + signature.bytes.length) return false;
  return signature.bytes.every((byte, index) => {
    const actual = bytes[signature.offset + index]!;
    const mask = signature.mask?.[index] ?? 0xff;
    return (actual & mask) === (byte & mask);
  });
}

function getExtension(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? name;
  const dot = leaf.lastIndexOf('.');
  return dot > 0 && dot < leaf.length - 1 ? leaf.slice(dot + 1).toLowerCase() : '';
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const options = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose at least one file.');
  const sampleBytes = Number(options.sampleBytes);
  if (![32, 64, 256].includes(sampleBytes)) throw new ToolError('Choose a valid header sample size.');

  const rows: string[][] = [];
  for (let index = 0; index < files.length; index++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[index]!;
    const bytes = new Uint8Array(await file.slice(0, sampleBytes).arrayBuffer());
    const matches = SIGNATURES.filter((signature) => matchSignature(bytes, signature));
    const match = matches.find((candidate) => candidate.format === 'WAV audio' && candidate.offset === 8)
      ?? matches[0];
    const detected = match?.format === 'WAV audio'
      ? match
      : match?.format === 'RIFF container' && bytes.length >= 12 &&
          bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
        ? { ...match, format: 'WAV audio', mime: 'audio/wav', extensions: ['wav'], confidence: 'strong' }
        : match?.format === 'RIFF container' && bytes.length >= 12 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
          ? { ...match, format: 'WebP image', mime: 'image/webp', extensions: ['webp'], confidence: 'strong' }
          : match;
    const extension = getExtension(file.name);
    const extensionMatch = detected ? detected.extensions.includes(extension) : false;
    const reportedMime = file.type || 'unknown';
    const mimeMatch = detected ? reportedMime === 'unknown' || reportedMime === detected.mime : false;
    let assessment: string;
    if (!detected) assessment = 'Unknown signature';
    else if (!extension) assessment = 'Detected; no extension to compare';
    else if (!extensionMatch) assessment = 'Extension mismatch';
    else assessment = 'Extension matches';

    const sample = bytes.subarray(0, Math.min(bytes.length, 32));
    rows.push([
      file.name,
      String(file.size),
      detected?.format ?? 'Unknown',
      detected?.mime ?? 'unknown',
      detected?.confidence ?? 'none',
      extension || '(none)',
      assessment,
      reportedMime,
      match ? String(mimeMatch) : 'n/a',
      toHex(sample) || '(empty file)',
    ]);
    onProgress?.((index + 1) / files.length, `Inspecting ${file.name}`);
  }

  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: ['File', 'Bytes', 'Detected format', 'Detected MIME', 'Match strength', 'Extension', 'Extension check', 'Browser MIME', 'MIME agrees', 'First bytes (hex)'],
        rows,
      }),
      render: 'table',
    },
    stats: { files: files.length, 'sample bytes per file': sampleBytes },
    notes: ['Signature detection is a format hint, not a complete validation or safety check. ZIP and container signatures may represent multiple formats.'],
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
