import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'qr-scanner',
  name: 'QR & Barcode Scanner',
  category: 'generators',
  summary:
    'Scan QR codes and barcodes from your camera or an image — decoded on-device with actions.',
  description:
    'Point your camera at a code, or scan a screenshot or photo, to read it. URLs, Wi-Fi join codes, contact cards, email, phone, SMS, location and OTP setup codes are recognised and turned into sensible actions. Decoding happens entirely in this tab — frames and images never leave your device.',
  keywords: [
    'qr scanner',
    'qr code reader',
    'scan qr code',
    'barcode scanner',
    'barcode reader',
    'camera scan',
    'wifi qr',
    'vcard qr',
    'decode qr',
    'read qr code',
    'image qr',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  camera: true,
  options: [
    {
      key: 'formats',
      label: 'Code types',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'Everything — QR and 1D/2D barcodes' },
        { value: 'qr', label: 'QR codes only' },
      ],
      help: 'Narrowing this can speed up files that contain lots of bar-like detail.',
    },
    {
      key: 'tryFallback',
      label: 'Use the fallback decoder when the browser finds nothing',
      type: 'boolean',
      default: true,
      help: 'The fallback decoder is a small script loaded on demand the first time it is needed.',
    },
    {
      key: 'invert',
      label: 'Also try inverted codes (light pattern on a dark background)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    { title: 'Scan a code from a screenshot' },
    { title: 'QR codes only, for a busy image', options: { formats: 'qr' } },
    { title: 'Read a light-on-dark code', options: { invert: true } },
  ],
  related: ['qr-code', 'barcode', 'vcard', 'otp-uri'],
  credits: [{ name: 'jsQR', url: 'https://github.com/cozmo/jsQR', license: 'Apache-2.0' }],
  status: 'beta',
  updated: '2026-10-17',
};
