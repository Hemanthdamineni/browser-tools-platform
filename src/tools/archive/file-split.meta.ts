import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-split',
  name: 'Split File into Chunks',
  category: 'archive',
  summary: 'Split a large file into numbered part chunks plus a JSON manifest.',
  description:
    'Slice a file into `.part001`, `.part002`… chunks with a tiny manifest that records the original name, size, SHA-256 and part list so a later join can verify integrity.',
  keywords: ['split', 'chunk', 'parts', 'manifest', 'large file'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'by-size',
      choices: [
        { value: 'by-size', label: 'By chunk size' },
        { value: 'by-count', label: 'By number of parts' },
      ],
    },
    {
      key: 'chunkSize',
      label: 'Chunk size',
      type: 'number',
      default: 5,
      min: 1,
      showWhen: { key: 'mode', value: 'by-size' },
    },
    {
      key: 'chunkUnit',
      label: 'Unit',
      type: 'select',
      default: 'MB',
      choices: [
        { value: 'KB', label: 'KB' },
        { value: 'MB', label: 'MB' },
      ],
      showWhen: { key: 'mode', value: 'by-size' },
    },
    {
      key: 'count',
      label: 'Number of parts',
      type: 'number',
      default: 4,
      min: 2,
      showWhen: { key: 'mode', value: 'by-count' },
    },
  ],
  article: [
    {
      heading: 'How the chunking works',
      body: 'The whole file is read into memory and cut into consecutive parts. By size, each chunk is floor(chunkSize x unit) bytes; by count, the file is divided into roughly equal parts. Part filenames are the original base name with a zero-padded suffix (.part001, .part002 and so on), plus one .manifest.json that records the original name, total byte size, the SHA-256 digest and the exact part list.',
    },
    {
      heading: 'Why a manifest is produced',
      body: 'The manifest is not a decoration: a companion join tool reads it to reassemble the chunks and verify integrity against the recorded SHA-256, so a missing or reordered part is caught instead of silently producing a corrupt file. Keep all chunks and the manifest together in the same folder.',
    },
    {
      heading: 'Choosing between modes',
      body: 'By-size is the obvious fit when a transport or email service has a hard per-file limit, so you set the chunk size to sit just under it. By-count is handier when you want a predictable number of parts, for example exactly four files to burn to a CD, and lets the tool decide how big each part must be.',
    },
    {
      heading: 'Limits and edge cases',
      body: 'The first file only is used, and the chunk size must be strictly smaller than the whole file or the tool refuses to split. The base name is derived by stripping the final extension, so foo.tar.gz becomes foo. Everything runs locally: the file is sliced with plain ArrayBuffer views and hashed with the browser Web Crypto SHA-256, and nothing is uploaded.',
    },
  ],
  examples: [
    { title: 'Split a file' },
    { title: 'Split by count into four parts', options: { mode: 'by-count', count: 4 } },
    {
      title: 'Split into 1 KB chunks',
      options: { mode: 'by-size', chunkSize: 1, chunkUnit: 'KB' },
    },
  ],
  faq: [
    {
      q: 'What does the manifest contain?',
      a: 'A JSON object with the original filename, total byte size, the SHA-256 digest of the whole file, and the ordered list of part names and sizes so a join can reassemble and verify the result.',
    },
    {
      q: 'Can I choose the part file names?',
      a: 'No. Parts are named after the original file base with a zero-padded numeric suffix, and the manifest is <base>.manifest.json. The numbering width grows to fit the total part count.',
    },
    {
      q: 'Is my file uploaded?',
      a: 'No. The file is read with your browser’s ArrayBuffer API and sliced into in-memory chunks, hashed with the Web Crypto SHA-256, and handed back as downloadable parts — all on-device and offline.',
    },
  ],
  related: ['file-join', 'file-metadata'],
  status: 'stable',
};
