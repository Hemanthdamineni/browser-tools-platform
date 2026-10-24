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
  article: [
    {
      heading: 'Draw, type or upload your mark',
      body: 'The sign flow gives you three ways to make a signature: draw it with a mouse, finger or stylus, type a name in one of four built-in styles, or upload a PNG of a signature you already have. The typed styles use fonts already on your device, so nothing is fetched from the web. Once the mark exists, drag it into place on a page preview.',
    },
    {
      heading: 'What flattened really means',
      body: 'The signature is painted into the page content itself with pdf-lib — it is not a form field, a button or a clickable annotation. The result is an ordinary PDF whose page simply contains the signature pixels, so a viewer sees it as part of the page and cannot toggle it off.',
    },
    {
      heading: 'Placement and rotation',
      body: 'Position is given as an x/y point in the browser’s display space (origin top-left, y growing down) and the height always follows the signature’s own aspect ratio, so nothing is stretched. If a placed mark would end up off the page or need to be shrunk to fit, the tool clamps it back inside and says so. On a rotated page the placement stays in step with the preview.',
    },
    {
      heading: 'What you cannot do here',
      body: 'An encrypted, password-protected PDF cannot be read until it is unlocked, so the tool refuses it rather than guessing. The signature is a bitmap of your mark, not a certificate-based digital signature — there is no PKI chain or tamper-evident digest. For cryptographic signing for compliance, use a dedicated signing service.',
    },
    {
      heading: 'Your mark stays on your device',
      body: 'The signature is drawn in this tab and embedded into the PDF on this machine — nothing is uploaded. Because a signature is not a credential to be synced, it is safest that it never leaves the browser, and the tool works offline.',
    },
  ],
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
