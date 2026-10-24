import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';

/** qpdf is compiled to WebAssembly and runs in this tab, never on a server. */
const qpdfCredit = {
  name: '@jspawn/qpdf-wasm',
  url: 'https://github.com/jsscheller/qpdf-wasm',
  license: 'Apache-2.0',
};

export const meta: ToolMeta = {
  id: 'pdf-protect',
  name: 'Protect PDF',
  category: 'pdf',
  summary: 'Add a password to a PDF with AES-256 encryption and optional printing limits.',
  description:
    'Encrypt a PDF with a password using AES-256 — the strongest encryption the PDF standard offers. You can also block printing, copying text and editing, and set a separate owner password.',
  keywords: [
    'pdf',
    'password protect pdf',
    'encrypt pdf',
    'aes-256',
    'lock pdf',
    'pdf security',
    'restrict printing',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'userPassword',
      label: 'Password to open the PDF',
      type: 'text',
      default: '',
      placeholder: 'Required',
      help: 'Anyone opening the file needs this password. The field is not masked, so mind who can see your screen — and keep the password safe: it cannot be recovered.',
    },
    {
      key: 'ownerPassword',
      label: 'Owner password (optional)',
      type: 'text',
      default: '',
      placeholder: 'Same as the password above',
      help: 'Lets the owner change the permissions later. Leave it empty to use the same password as above.',
    },
    {
      key: 'allowPrint',
      label: 'Allow printing',
      type: 'boolean',
      default: true,
    },
    {
      key: 'allowCopy',
      label: 'Allow copying text and images',
      type: 'boolean',
      default: true,
      help: 'Blocks copy/paste and text extraction in readers that honour it. Screen readers keep working: accessibility extraction is never blocked.',
    },
    {
      key: 'allowModify',
      label: 'Allow editing the document',
      type: 'boolean',
      default: true,
    },
  ],
  article: [
    {
      heading: 'What comes back',
      body: 'Drop an unprotected PDF and give the password that should open it. The tool returns a copy of the file, named after the original with -protected.pdf appended, encrypted with AES-256 at PDF revision 6. Before handing it over it verifies that the result really carries an /Encrypt dictionary.',
    },
    {
      heading: 'One password or two',
      body: 'The user password opens the file; the optional owner password lets its holder change the permissions later. Leave the owner field empty and both roles share one secret. Each password may be at most 127 bytes, the longest revision 6 reads — beyond that a reader can never match it.',
    },
    {
      heading: 'The three permission switches',
      body: 'Allow printing, Allow copying text and images, and Allow editing all start enabled. Turning one off writes the matching restriction into the PDF, and the result card lists exactly what is now blocked. Accessibility extraction is never restricted, so screen readers keep working even when copying is off.',
    },
    {
      heading: 'Read this before you protect anything',
      body: 'A forgotten password means a file that can never be opened again: it is the only key and it is stored nowhere. An already-protected PDF is refused rather than re-encrypted, files over 100 MB are rejected, and the flags are a request to the reader, not cryptographic enforcement.',
    },
    {
      heading: 'The encryption engine runs in your browser',
      body: 'qpdf is compiled to WebAssembly and executed in this tab, so the PDF and both passwords stay on your machine. Nothing is uploaded, the page contacts no server, and it works offline once loaded.',
    },
  ],
  examples: [
    { title: 'Protect a PDF with a password' },
    {
      title: 'A separate owner password',
      options: { userPassword: 'open sesame', ownerPassword: 'change later' },
    },
    {
      title: 'Block printing and copying',
      options: { userPassword: 'open sesame', allowPrint: false, allowCopy: false },
    },
  ],
  faq: [
    {
      q: 'What happens if I forget the password?',
      a: 'The file cannot be opened again. The password is the only key and it is not stored anywhere — there is no recovery service and no back door. Keep it somewhere safe before you delete the original.',
    },
    {
      q: 'Which encryption is used?',
      a: 'AES-256 with revision 6 of the PDF standard (the same scheme current Acrobat versions use), applied by qpdf compiled to WebAssembly.',
    },
    {
      q: 'Does my PDF or my password leave my device?',
      a: 'No. The file is read in this tab, encrypted by WebAssembly on your own machine, and the result is handed back to you. Nothing is uploaded and the page makes no network requests.',
    },
    {
      q: 'Can I protect a PDF that is already password-protected?',
      a: 'No. This tool refuses an already-encrypted file instead of quietly re-encrypting it and replacing a password you may still need. Open it with its current password (and remove that protection) first.',
    },
    {
      q: 'Do PDF readers really respect the printing and copying limits?',
      a: 'Mainstream readers honour them, but they are a request to the reader rather than cryptographic protection: anyone who can open the file with the user password can still print the screen. Use them to signal intent, not to make content unextractable.',
    },
  ],
  related: ['pdf-sign', 'pdf-metadata', 'pdf-compress'],
  credits: [qpdfCredit, pdfCredit],
  status: 'beta',
  updated: '2026-10-24',
};
