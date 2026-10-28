import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './credits';
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
    { key: 'page', label: 'Page to sign', type: 'number', default: 1, min: 1 },
    {
      key: 'x',
      label: 'X position (pt from the left)',
      type: 'number',
      default: 72,
      min: 0,
    },
    {
      key: 'y',
      label: 'Y position (pt from the top)',
      type: 'number',
      default: 600,
      min: 0,
    },
    {
      key: 'width',
      label: 'Signature width (pt)',
      type: 'number',
      default: 180,
      min: 8,
    },
    {
      // Filled in by the signature panel with the PNG data URL of the mark the
      // user drew, typed or uploaded. Declared so the contract is explicit;
      // there is no sensible default — an empty value means "no signature".
      key: 'signature',
      label: 'Signature image (PNG data URL)',
      type: 'text',
      default: '',
    },
  ],
  examples: [
    { title: 'Sign the first page' },
    {
      title: 'Sign page 3, upper right',
      options: { page: 3, x: 360, y: 48, width: 160 },
    },
    {
      title: 'A smaller signature low on the page',
      options: { page: 1, x: 72, y: 690, width: 100 },
    },
  ],
  related: ['pdf-watermark', 'pdf-page-numbers', 'pdf-metadata'],
  credits: [pdfCredit, pdfjsCredit],
  status: 'beta',
};
