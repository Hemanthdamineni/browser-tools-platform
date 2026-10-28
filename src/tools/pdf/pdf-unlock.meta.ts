import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';

const qpdfCredit = {
  name: '@jspawn/qpdf-wasm',
  url: 'https://github.com/jsscheller/qpdf-wasm',
  license: 'Apache-2.0',
};

export const meta: ToolMeta = {
  id: 'pdf-unlock',
  name: 'Unlock PDF',
  category: 'pdf',
  summary: 'Remove a password from a PDF using qpdf-wasm.',
  description:
    'Decrypt a password-protected PDF with the known user password. The result is the original PDF without encryption.',
  keywords: ['pdf', 'unlock pdf', 'remove password', 'decrypt pdf', 'qpdf'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'userPassword',
      label: 'Password to unlock the PDF',
      type: 'text',
      default: '',
      placeholder: 'Required',
      help: 'The password you know that opens the PDF. The field is not masked.',
    },
  ],
  examples: [{ title: 'Unlock a password-protected PDF' }],
  faq: [
    {
      q: 'What happens if the password is wrong?',
      a: 'The file remains encrypted and the operation fails with a clear error. No brute-force or cracking occurs — this tool only uses the password you provide.',
    },
    {
      q: 'What is produced?',
      a: 'The decrypted PDF without any password protection.',
    },
    {
      q: 'Does my PDF or my password leave my device?',
      a: 'No. Everything runs in this tab; nothing is uploaded.',
    },
  ],
  related: [  "pdf-protect",
  "pdf-metadata"],
  credits: [qpdfCredit, pdfCredit],
  status: 'beta',
  updated: '2026-10-26',
};
