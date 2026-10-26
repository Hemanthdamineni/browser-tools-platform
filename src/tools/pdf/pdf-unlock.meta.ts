import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';

/** qpdf is compiled to WebAssembly and runs in this tab, never on a server. */
const qpdfCredit = {
  name: '@jspawn/qpdf-wasm',
  url: 'https://github.com/jsscheller/qpdf-wasm',
  license: 'Apache-2.0',
};

export const meta: ToolMeta = {
  id: 'pdf-unlock',
  name: 'Unlock PDF',
  category: 'pdf',
  summary: 'Remove a password you already know from a PDF, on your own device.',
  description:
    'Strip the password off a PDF you know the password for. The file is decrypted by WebAssembly on your machine and handed back with no password at all — nothing is uploaded. A wrong password is reported plainly; this tool never tries to guess or crack one.',
  keywords: [
    'pdf',
    'unlock pdf',
    'remove pdf password',
    'decrypt pdf',
    'password protect pdf',
    'open protected pdf',
    'pdf security',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      default: '',
      placeholder: 'The password this PDF was locked with',
      help: 'The password you (or whoever protected the file) used to open it. The field is not masked, so mind who can see your screen.',
    },
  ],
  examples: [
    { title: 'Unlock a PDF with a known password', options: { password: 'hunter2' } },
    { title: 'Remove the password from an office file', options: { password: 'Quarterly-2026' } },
    {
      title: 'Strip protection with a passphrase',
      options: { password: 'correct horse battery staple' },
    },
  ],
  related: ['pdf-protect', 'pdf-metadata', 'pdf-compress'],
  credits: [qpdfCredit, pdfCredit],
  status: 'beta',
};
