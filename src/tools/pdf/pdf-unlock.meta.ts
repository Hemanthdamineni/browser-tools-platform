import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';

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
  ],
  faq: [
    {
      q: 'Does this tool crack passwords?',
      a: 'No. It only decrypts a PDF when you supply the exact password it was protected with. A wrong password is reported and the file stays locked — there is no brute-force, no dictionary and no back door here, by design.',
    },
    {
      q: 'What if I forget the password?',
      a: 'Then the file cannot be unlocked. The password is the only key and there is no recovery service, so keep it somewhere safe. Deleting the protection requires knowing the password that protects the file.',
    },
    {
      q: 'Does my PDF or my password leave my device?',
      a: 'No. The file is read in this tab, decrypted by WebAssembly on your own machine, and the result is handed back to you. Nothing is uploaded and the page makes no network requests.',
    },
    {
      q: 'Why does the page count change after unlocking?',
      a: 'It does not. The decrypted PDF keeps every page and object; only the encryption layer is removed, so the result has the same number of pages as the original.',
    },
  ],
  article: [
    {
      heading: 'What this tool does',
      body: 'You pick a password-protected PDF and type the password it was locked with. The file is decrypted by qpdf — the PDF toolkit — compiled to WebAssembly, and the result is a copy with the encryption removed: it opens without a password in any reader. The original file is never modified.',
    },
    {
      heading: 'Why it never guesses a password',
      body: 'Decryption needs the exact password, which qpdf only accepts when it matches what was used to encrypt the file. There is no attempt to recover or guess the password if you get it wrong — the tool says the password is wrong and stops. If you do not know the password, no tool can honestly open the file.',
    },
    {
      heading: 'Wrong password versus a broken file',
      body: 'The two failures are told apart. A mistyped password is reported as a wrong password with a hint to check letter case and spaces. A file that cannot be decrypted for another reason — damage, or an unsupported encryption scheme — is reported as damaged or unsupported, with the engine’s own message as a hint.',
    },
    {
      heading: 'Where the work happens',
      body: 'Everything runs on your device. The file is read in this tab, decrypted by WebAssembly in a worker, and handed back to you. No PDF and no password are uploaded anywhere, and the page makes no network requests, so the decrypted copy stays as private as the file itself.',
    },
  ],
  related: ['pdf-protect', 'pdf-metadata', 'pdf-compress'],
  credits: [qpdfCredit, pdfCredit],
  status: 'beta',
};
