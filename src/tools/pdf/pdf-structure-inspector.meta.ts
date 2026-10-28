import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'pdf-structure-inspector',
  name: 'PDF Structure Inspector',
  category: 'pdf',
  summary:
    'Inspect a PDF’s internals: header version, xref, objects, trailer, encryption and damage.',
  description:
    'Open a PDF and read what is actually inside it, without rendering a page: the header version, the cross-reference table and every object offset, the trailer dictionary (/Root, /Info, /ID, /Encrypt, /Prev), the page tree, whether the file is encrypted or linearized, how many incremental updates were appended, and whether the %%EOF marker and startxref offset actually line up. The inspector validates each xref row against the bytes on disk, so a file whose object offsets drifted (the classic cause of “repair me” dialogs and pages that silently disappear) is reported precisely. Malformed xref syntax, missing objects, truncated files, broken object streams and damaged streams are listed as findings with line and offset. Everything runs on-device — the PDF never leaves your browser.',
  keywords: [
    'pdf',
    'structure',
    'xref',
    'cross reference',
    'trailer',
    'objects',
    'linearized',
    'encrypted',
    'damaged pdf',
    'repair pdf',
    'pdf internals',
    'startxref',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: false,
  accept: '.pdf,application/pdf',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'objects', label: 'Cross-reference' },
        { value: 'trailer', label: 'Trailer' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'detail',
      label: 'Object sample size',
      type: 'number',
      default: 50,
      min: 0,
    },
  ],
  examples: [{ title: 'Find out why a PDF says it needs repair' }],
  related: ['pdf-metadata', 'pdf-compress', 'pdf-extract-text', 'binary-file-signature'],
  status: 'stable',
};