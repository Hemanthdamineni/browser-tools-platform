import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './binary-file-signature.meta';

const MAX_PREFIX_BYTES = 512;

type Signature = {
  name: string;
  mime: string;
  extensions: string;
  bytes: number[];
  offset?: number;
  note?: string;
};

const signatures: Signature[] = [
  {
    name: 'PNG image',
    mime: 'image/png',
    extensions: '.png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { name: 'JPEG image', mime: 'image/jpeg', extensions: '.jpg, .jpeg', bytes: [0xff, 0xd8, 0xff] },
  { name: 'GIF image', mime: 'image/gif', extensions: '.gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  {
    name: 'WebP image',
    mime: 'image/webp',
    extensions: '.webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    note: 'Also requires WEBP at byte offset 8.',
  },
  {
    name: 'PDF document',
    mime: 'application/pdf',
    extensions: '.pdf',
    bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
  {
    name: 'ZIP archive / package',
    mime: 'application/zip',
    extensions: '.zip, .docx, .xlsx, .pptx, .jar, .apk',
    bytes: [0x50, 0x4b, 0x03, 0x04],
    note: 'Container only; package subtype is not inspected.',
  },
  {
    name: 'ZIP archive (empty)',
    mime: 'application/zip',
    extensions: '.zip',
    bytes: [0x50, 0x4b, 0x05, 0x06],
  },
  {
    name: 'ZIP archive (spanned)',
    mime: 'application/zip',
    extensions: '.zip',
    bytes: [0x50, 0x4b, 0x07, 0x08],
  },
  { name: 'GZIP archive', mime: 'application/gzip', extensions: '.gz, .tgz', bytes: [0x1f, 0x8b] },
  {
    name: '7-Zip archive',
    mime: 'application/x-7z-compressed',
    extensions: '.7z',
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
  },
  {
    name: 'RAR archive',
    mime: 'application/vnd.rar',
    extensions: '.rar',
    bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
  },
  {
    name: 'TAR archive',
    mime: 'application/x-tar',
    extensions: '.tar',
    bytes: [0x75, 0x73, 0x74, 0x61, 0x72],
    offset: 257,
  },
  {
    name: 'SQLite database',
    mime: 'application/vnd.sqlite3',
    extensions: '.sqlite, .db',
    bytes: [
      0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33,
      0x00,
    ],
  },
  {
    name: 'Microsoft Compound File',
    mime: 'application/x-ole-storage',
    extensions: '.doc, .xls, .ppt, .msg',
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  { name: 'MP3 audio (ID3)', mime: 'audio/mpeg', extensions: '.mp3', bytes: [0x49, 0x44, 0x33] },
  {
    name: 'WAV audio',
    mime: 'audio/wav',
    extensions: '.wav',
    bytes: [0x52, 0x49, 0x46, 0x46],
    note: 'Also requires WAVE at byte offset 8.',
  },
  {
    name: 'AIFF audio',
    mime: 'audio/aiff',
    extensions: '.aiff, .aif',
    bytes: [0x46, 0x4f, 0x52, 0x4d],
    note: 'Also requires AIFF or AIFC at byte offset 8.',
  },
  {
    name: 'MP4 / ISO Base Media',
    mime: 'video/mp4',
    extensions: '.mp4, .m4a, .mov',
    bytes: [0x66, 0x74, 0x79, 0x70],
    offset: 4,
    note: 'Container family; subtype depends on the brand at byte offset 4.',
  },
  { name: 'MP3 audio frame', mime: 'audio/mpeg', extensions: '.mp3', bytes: [0xff, 0xfb] },
  {
    name: 'Ogg media',
    mime: 'application/ogg',
    extensions: '.ogg, .oga, .ogv',
    bytes: [0x4f, 0x67, 0x67, 0x53],
  },
  { name: 'FLAC audio', mime: 'audio/flac', extensions: '.flac', bytes: [0x66, 0x4c, 0x61, 0x43] },
  {
    name: 'WASM module',
    mime: 'application/wasm',
    extensions: '.wasm',
    bytes: [0x00, 0x61, 0x73, 0x6d],
  },
  {
    name: 'ELF executable / object',
    mime: 'application/x-elf',
    extensions: 'Linux executable or object',
    bytes: [0x7f, 0x45, 0x4c, 0x46],
  },
  {
    name: 'Windows PE executable',
    mime: 'application/vnd.microsoft.portable-executable',
    extensions: '.exe, .dll',
    bytes: [0x4d, 0x5a],
    note: 'MZ header only; PE signature is located later in the file.',
  },
  {
    name: 'Mach-O executable / object',
    mime: 'application/x-mach-binary',
    extensions: 'macOS executable or object',
    bytes: [0xfe, 0xed, 0xfa, 0xce],
  },
  {
    name: 'Mach-O 64-bit executable / object',
    mime: 'application/x-mach-binary',
    extensions: 'macOS executable or object',
    bytes: [0xfe, 0xed, 0xfa, 0xcf],
  },
  {
    name: 'Java class',
    mime: 'application/java-vm',
    extensions: '.class',
    bytes: [0xca, 0xfe, 0xba, 0xbe],
  },
  {
    name: 'PCAP capture',
    mime: 'application/vnd.tcpdump.pcap',
    extensions: '.pcap',
    bytes: [0xd4, 0xc3, 0xb2, 0xa1],
  },
  {
    name: 'PCAP capture (big-endian)',
    mime: 'application/vnd.tcpdump.pcap',
    extensions: '.pcap',
    bytes: [0xa1, 0xb2, 0xc3, 0xd4],
  },
  {
    name: 'BZIP2 archive',
    mime: 'application/x-bzip2',
    extensions: '.bz2',
    bytes: [0x42, 0x5a, 0x68],
  },
  {
    name: 'XZ archive',
    mime: 'application/x-xz',
    extensions: '.xz',
    bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00],
  },
];

function extension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot).toLowerCase() : '';
}

function matchAt(bytes: Uint8Array, signature: Signature): boolean {
  const offset = signature.offset ?? 0;
  if (bytes.length < offset + signature.bytes.length) return false;
  return signature.bytes.every((byte, index) => bytes[offset + index] === byte);
}

function identify(bytes: Uint8Array): Signature | undefined {
  const riff =
    bytes.length >= 12 &&
    matchAt(
      bytes,
      signatures.find((s) => s.name === 'WebP image')!,
    );
  if (riff) {
    if (String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') {
      return signatures.find((s) => s.name === 'WebP image');
    }
    if (String.fromCharCode(...bytes.subarray(8, 12)) === 'WAVE') {
      return signatures.find((s) => s.name === 'WAV audio');
    }
  }
  if (
    bytes.length >= 12 &&
    matchAt(
      bytes,
      signatures.find((s) => s.name === 'AIFF audio')!,
    )
  ) {
    const form = String.fromCharCode(...bytes.subarray(8, 12));
    if (form === 'AIFF' || form === 'AIFC') return signatures.find((s) => s.name === 'AIFF audio');
  }
  if (
    bytes.length >= 8 &&
    matchAt(
      bytes,
      signatures.find((s) => s.name === 'MP4 / ISO Base Media')!,
    )
  ) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    return {
      ...signatures.find((s) => s.name === 'MP4 / ISO Base Media')!,
      name:
        brand === 'qt  '
          ? 'QuickTime movie'
          : brand.startsWith('M4')
            ? 'MPEG-4 audio/video'
            : 'ISO Base Media file',
      mime: brand === 'qt  ' ? 'video/quicktime' : 'video/mp4',
    };
  }
  return signatures.find((signature) => matchAt(bytes, signature));
}

function hexPreview(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0').toUpperCase(),
  ).join(' ');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one file.');

  const rows: string[][] = [];
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i]!;
    onProgress?.(i / files.length, `Inspecting ${file.name}`);
    const prefix = new Uint8Array(await file.slice(0, MAX_PREFIX_BYTES).arrayBuffer());
    const signature = identify(prefix);
    const ext = extension(file.name);
    const extensionMatch = signature
      ? signature.extensions.split(/,\s*/).some((candidate) => candidate.toLowerCase() === ext) ||
        (ext === '' && signature.name !== 'TAR archive')
        ? ext === ''
          ? 'No extension'
          : 'Matches'
        : 'Differs'
      : ext === ''
        ? 'No extension'
        : 'Unverified';
    rows.push([
      file.name,
      signature?.name ?? (file.size === 0 ? 'Empty file' : 'Unknown'),
      signature?.mime ?? 'Unknown',
      extensionMatch,
      `${file.size} bytes`,
      hexPreview(prefix) || '—',
      signature?.note ?? '',
    ]);
  }
  onProgress?.(1, 'Done');

  const unknownCount = rows.filter((row) => row[1] === 'Unknown' || row[1] === 'Empty file').length;
  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: [
          'Filename',
          'Detected format',
          'Likely MIME',
          'Extension check',
          'File size',
          'First bytes (hex)',
          'Notes',
        ],
        rows,
      }),
      render: 'table',
    },
    warnings: [
      'Signature detection is heuristic: it identifies recognizable prefixes, does not validate file contents, and is not a security verdict.',
    ],
    stats: {
      files: files.length,
      identified: files.length - unknownCount,
      unknown: unknownCount,
      'bytes read per file (max)': MAX_PREFIX_BYTES,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
