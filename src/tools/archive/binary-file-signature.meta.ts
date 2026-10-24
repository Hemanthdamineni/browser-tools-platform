import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'binary-file-signature',
  name: 'File Signature Inspector',
  category: 'archive',
  summary: 'Identify common file formats from their binary signatures, not just extensions.',
  description:
    'Inspect the first 512 bytes of selected files and compare them with known magic-byte signatures. Results are best-effort format hints, not a security verdict; unknown and extensionless files are supported. Files stay on your device.',
  keywords: [
    'file signature',
    'magic bytes',
    'file type detector',
    'identify unknown file',
    'file format inspector',
    'file header',
    'magic number',
    'binary format',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  multiple: true,
  accept: '',
  worker: true,
  faq: [
    {
      q: 'What does a signature match prove?',
      a: 'A match suggests a file format based on its leading bytes. It does not validate the whole file, prove the file is safe, or guarantee that the extension matches its contents.',
    },
    {
      q: 'How much of each file is read?',
      a: 'At most the first 512 bytes. Detection is quick even for large files; formats whose identifiers occur later in a file may be reported as unknown.',
    },
    {
      q: 'Why might a ZIP-based document be reported as ZIP?',
      a: 'DOCX, XLSX, PPTX, and other package formats use ZIP containers. Distinguishing them requires inspecting archive entries; this tool reports the container signature only.',
    },
  ],
  examples: [
    { title: 'Identify an extensionless file' },
    { title: 'Check a renamed file against its contents' },
    { title: 'Spot a ZIP-based Office package' },
  ],
  article: [
    {
      heading: 'What the File Signature Inspector does',
      body: 'For each file it reads the first 512 bytes, compares them with known magic-number signatures, and reports the format, likely MIME type, size and a 16-byte hex preview. Matches cover PNG, JPEG, WebP, PDF, ZIP, GZIP, SQLite, ELF, WASM, MP3 and about twenty more. Extensionless files work too, so a file renamed to .bin is still identified.',
    },
    {
      heading: 'When to use it',
      body: 'Use it when a download arrives with a missing or misleading extension and you need to know what to open it with, or to confirm that an export really produced the format you asked for. Read the result as a hint: leading bytes are strong evidence, but the tool never parses the rest of the file.',
    },
    {
      heading: 'Reading the output columns',
      body: 'The extension check compares the signature with the file name: Matches, Differs, or Unverified when nothing was recognised. DOCX, XLSX and PPTX are all reported as ZIP, since they are ZIP containers; WebP, WAV and AIFF are only confirmed when the four identifying bytes after the RIFF header are present.',
    },
    {
      heading: 'Limits and odd cases',
      body: 'Only the listed formats are detected; anything else reads as Unknown. A truncated file can still match its header. MP3 is spotted by an ID3 tag or a raw frame sync word, and MP4 files take their label from the brand text, so the container may appear as QuickTime movie or MPEG-4 audio or video.',
    },
    {
      heading: 'Nothing leaves your device',
      body: 'Detection runs entirely in your browser. Only 512 bytes per file are read, nothing is uploaded, and the tool works offline, so confidential files stay on the machine.',
    },
  ],
  related: ['file-hash', 'mime-lookup'],
  status: 'stable',
};
