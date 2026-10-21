import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-sign',
  name: 'Sign PDF',
  category: 'pdf',
  summary: 'Draw, type or upload a signature, place it on a page and flatten it into the PDF.',
  description:
    'Sign a PDF with your own mark. Draw it, type it or upload a PNG, drag it into place on the page preview, then flatten it into the page so the result is an ordinary PDF.',
  keywords: ['pdf', 'sign', 'signature', 'e-sign', 'sign here', 'flatten', 'esignature'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  // The signing flow (draw / type / upload → preview → place) cannot be
  // expressed by the generic option form, so the tool opts into the dedicated
  // signature panel. The options below are the placement that panel drives —
  // they are read by `run()` through `resolveOptions` and keep the tool
  // usable without the UI.
  panel: 'signature',
  options: [
    { key: 'page', label: 'Page to sign', type: 'number', default: 1, min: 1, max: 1000 },
    {
      key: 'x',
      label: 'X position (pt from the left)',
      type: 'number',
      default: 72,
      min: 0,
      max: 5000,
    },
    {
      key: 'y',
      label: 'Y position (pt from the top)',
      type: 'number',
      default: 600,
      min: 0,
      max: 5000,
    },
    {
      key: 'width',
      label: 'Signature width (pt)',
      type: 'number',
      default: 180,
      min: 8,
      max: 2000,
    },
  ],
  examples: [{ title: 'Sign the first page' }],
  faq: [
    {
      q: 'Is the signature really private?',
      a: 'Yes. Your signature is drawn in this tab and embedded into the PDF on this device — nothing is uploaded.',
    },
    {
      q: 'What does "flattened" mean?',
      a: 'The signature is painted into the page content, so it becomes part of the page itself. It is not a form field or a clickable annotation.',
    },
    {
      q: 'Can I sign a password-protected PDF?',
      a: 'No. Unlock the document first — an encrypted PDF cannot be read until it is decrypted.',
    },
    {
      q: 'Which signature types are supported?',
      a: 'Draw it with a mouse, finger or stylus, type a name in one of four styles, or upload a PNG. Typed signatures use fonts that are already on your device, so nothing is fetched from the web.',
    },
  ],
  related: ['pdf-watermark', 'pdf-page-numbers', 'pdf-metadata'],
  credits: [pdfCredit, pdfjsCredit],
  status: 'beta',
};
