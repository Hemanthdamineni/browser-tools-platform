import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'qr-scanner',
  name: 'QR Code Scanner',
  category: 'generators',
  summary:
    'Decode QR codes from images or your camera, with actions for URLs, Wi-Fi and contacts.',
  description:
    'Read QR codes from screenshots, saved photos or your camera. Everything is decoded on this device — images are never uploaded — and the result comes with explicit actions: open or copy a link, show Wi-Fi details, or save a contact as .vcf.',
  keywords: [
    'qr scanner',
    'qr reader',
    'decode qr',
    'read qr code',
    'wifi qr',
    'vcard qr',
    'barcode scanner',
    'camera qr',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'tryHarder',
      label: 'Try harder (rotated and inverted codes)',
      type: 'boolean',
      default: true,
      help: 'Adds 90°/180°/270° passes and both polarities. Slower, but reads codes that are sideways or white-on-black.',
    },
    {
      key: 'maxDimension',
      label: 'Max scan size (px, longest edge)',
      type: 'number',
      default: 2048,
      min: 256,
      max: 8192,
      help: 'Large images are downscaled before decoding. Raise it if a small code in a big photo is not found.',
    },
    {
      key: 'textExport',
      label: 'Also save decoded text as .txt',
      type: 'boolean',
      default: true,
    },
  ],
  faq: [
    {
      q: 'Does my image get uploaded anywhere?',
      a: 'No. The file is read into a Web Worker in this tab, decoded on your device, and thrown away when you close the page. There is no upload, no account and no telemetry — the tool even works offline once the page has loaded.',
    },
    {
      q: 'Why was my code not found?',
      a: 'Downscaling, blur and low contrast are the usual culprits. Crop tightly around the code and try again, raise "Max scan size", and keep "Try harder" on — it also tries rotated and inverted (white-on-black) codes. A screenshot is usually crisper than a photo of a screen.',
    },
    {
      q: 'Can it read several codes in one image?',
      a: 'Browsers with a built-in BarcodeDetector (Chrome, Edge, and recent Safari and Firefox) return every code they find. The bundled jsQR fallback returns the most readable one, so on those browsers an image with multiple codes reports a single result.',
    },
    {
      q: 'Is it safe to open a link from a QR code?',
      a: 'The tool never opens anything by itself. Links are only offered when the scheme is one browsers can open, so "javascript:", "data:" and other dangerous schemes stay inert text. Even so, treat an unexpected link like an unexpected email — the buttons are yours to press.',
    },
    {
      q: 'What can I do with each result?',
      a: 'Links get Open and Copy. Wi-Fi join codes show the network name and security, with a copy button for the password. Contacts show their parsed fields and can be saved as a .vcf file. Everything else is plain text you can copy.',
    },
    {
      q: 'Does it work without a camera?',
      a: 'Yes — uploading an image is the main path. The camera panel is optional and only starts when you press its button, and frames are decoded on this device exactly like uploaded files.',
    },
  ],
  related: ['qr-code', 'barcode', 'vcard', 'image-metadata'],
  credits: [{ name: 'jsQR', url: 'https://github.com/cozmo/jsQR', license: 'Apache-2.0' }],
  status: 'beta',
};
