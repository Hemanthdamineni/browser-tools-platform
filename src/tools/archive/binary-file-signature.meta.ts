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
  related: ['file-hash', 'mime-lookup'],
  status: 'stable',
};
