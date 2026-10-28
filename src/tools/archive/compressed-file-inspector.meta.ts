import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'compressed-file-inspector',
  name: 'Compressed File Inspector',
  category: 'archive',
  summary:
    'Identify zstd, xz, bzip2, gzip, lz4 and brotli files and read their headers, sizes and checksums.',
  description:
    'Drop a compressed file and see what it really is: the container format, its magic bytes, the frame or member count, the declared uncompressed size, the compression level where the format records one, and which checksum algorithm protects the data. The inspector parses the headers itself, so it reports what the bytes say rather than what the file extension claims — useful when a .zst is actually gzip, when a “corrupt” download is a truncated frame, or when you need the original filename and modification time stored in a gzip header. Every frame, member and block is walked and the checksum flag is checked against the available bytes; damaged or truncated streams are reported with the byte offset where parsing stopped. Supports zstd frames, xz streams, bzip2 header blocks, gzip members, lz4 frames and brotli streams. Everything runs on-device.',
  keywords: [
    'zstd',
    'zstandard',
    'xz',
    'lzma',
    'bzip2',
    'gzip',
    'lz4',
    'brotli',
    'compression',
    'archive',
    'file type',
    'checksum',
    'magic bytes',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.zst,.zstd,.xz,.lzma,.bz2,.gz,.tgz,.lz4,.br,.z,Z,compress,.tzst,.txz,.tbz2',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'structure', label: 'Frames & members' },
        { value: 'header', label: 'Header fields' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'maxUnits',
      label: 'Max frames/members listed',
      type: 'number',
      default: 100,
      min: 0,
    },
  ],
  examples: [{ title: 'Check whether a downloaded file is really zstd' }],
  related: ['zip-inspect', 'binary-file-signature', 'file-metadata', 'gzip'],
  status: 'stable',
};