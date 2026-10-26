import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';

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
  related: ['pdf-sign', 'pdf-metadata', 'pdf-compress'],
  credits: [qpdfCredit, pdfCredit],
  status: 'beta',
  updated: '2026-10-24',
};
