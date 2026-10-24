import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-metadata',
  name: 'File Metadata',
  category: 'archive',
  summary: 'Inspect file names, sizes, MIME types, timestamps and SHA-256 hashes.',
  description:
    'Report metadata for one or more selected files locally: name, size, MIME type, last-modified time and a SHA-256 hash for integrity checks.',
  keywords: ['file metadata', 'mime type', 'size', 'sha256', 'modified'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [{ key: 'hash', label: 'Compute SHA-256', type: 'boolean', default: true }],
  article: [
    {
      heading: 'What the report contains',
      body: 'Each selected file is read in memory to fill five columns: its name (or the folder-relative path when a whole directory is dropped), the MIME type the browser guessed, a human-readable size, the last-modified time in ISO 8601, and a SHA-256 digest computed with the browser Web Crypto. The result renders as a table, and the same data is exposed underneath as JSON with headers and rows.',
    },
    {
      heading: 'When a hash is the point',
      body: 'Use it to verify a download: hash the file here and compare the 64-character lowercase digest with the one the publisher lists for sha256sum. Keep Compute SHA-256 on for that; switch it off when you only need a quick listing of names, sizes and dates.',
    },
    {
      heading: 'What the single option changes',
      body: 'Compute SHA-256 defaults to on. Turning it off replaces the digest column with an em dash and skips the hashing pass entirely, which saves time on large files. When it stays on, hashing runs sequentially across the selection and progress reports the file currently being read.',
    },
    {
      heading: 'Edge cases and privacy',
      body: 'Files with no detected type fall back to application/octet-stream, a missing or invalid timestamp shows as an em dash, and an empty selection raises an error rather than an empty table. Hashing buffers each whole file, so very large files are slow. Nothing is uploaded: the digest comes from the browser Web Crypto and the page keeps working offline.',
    },
  ],
  examples: [
    { title: 'Inspect file metadata' },
    { title: 'Size and date check only', options: { hash: false } },
    { title: 'Hash a whole folder upload' },
  ],
  faq: [
    {
      q: 'Is the digest the same as sha256sum?',
      a: 'Yes. It is standard SHA-256 over the raw file bytes, printed as lowercase hex, so it matches sha256sum, certutil -hashfile or any other SHA-256 tool. Switch the option off when you do not need it.',
    },
    {
      q: 'Why does the MIME type look wrong?',
      a: 'The type is whatever the browser guessed, usually from the file extension rather than a byte-level inspection, and unknown cases fall back to application/octet-stream. The size and the hash are exact regardless of what the type says.',
    },
    {
      q: 'Is there a limit on how many files I can pick?',
      a: 'No count limit is enforced, but files are read and hashed one at a time in selection order, so a large batch takes as long as the sum of its files. Progress names the file being processed.',
    },
  ],
  related: ['file-split', 'base64'],
  status: 'stable',
};
