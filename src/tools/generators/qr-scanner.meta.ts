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
  article: [
    {
      heading: 'Two ways to feed it a code',
      body: 'The scanner accepts a live camera feed, accessed in the panel and only over https, or an image file such as a screenshot or photo. Camera frames are decoded continuously as you aim; a file is decoded once. Either way the payload is displayed in full rather than acted on, and nothing is requested to resolve what it reads.',
    },
    {
      heading: 'Which codes and which decoder',
      body: 'QR codes are read in any orientation, including inverted ones when that option is on. Common 1D barcodes such as EAN-13, UPC-A, Code 128 and Code 39 are read when the browser ships a built-in detector, as Chrome, Edge and Android browsers do. Where the browser finds nothing, the fallback decoder loads on demand and is tried.',
    },
    {
      heading: 'Payloads are recognised, not obeyed',
      body: 'A URL, Wi-Fi join string, vCard, mailto, telephone number, SMS, geo position, otpauth setup URI or plain text is recognised and shown as fields you can copy. Opening a link is a button you press deliberately, and unsafe schemes such as javascript: and data: are refused as links outright, so a malicious code cannot act on its own.',
    },
    {
      heading: 'Failing scans, and where frames go',
      body: 'Codes fail for practical reasons: too far away, glare or shadow over the pattern, motion blur, or a stylised design that breaks the module grid; getting closer so the code fills the frame fixes most cases, as does cropping in a photo. Camera frames and images are decoded in this browser tab, never recorded or uploaded; the only fetch is the fallback script itself, and only when a scan needs it.',
    },
  ],
  faq: [
    {
      q: 'Is my camera feed uploaded anywhere?',
      a: 'No. Frames are read and decoded inside this browser tab and are never recorded, stored or sent over the network. The only thing the page ever downloads is its own JavaScript, served from this site.',
    },
    {
      q: 'Which browsers can scan a camera feed?',
      a: 'Any browser with camera support works. Chrome, Edge and Android browsers also have a built-in barcode detector, which is used first; Firefox, Safari and older browsers fall back to a bundled decoder that is loaded only when needed. Camera access requires an https:// page.',
    },
    {
      q: 'Why did it not find my code?',
      a: 'Get closer so the code fills more of the frame, avoid glare and heavy shadows, and hold steady for a moment. For a photo, crop tightly around the code. Very small, motion-blurred or heavily stylised codes may be unreadable — try scanning the original instead.',
    },
    {
      q: 'What kinds of codes does it read?',
      a: 'QR codes in any orientation (including inverted), plus common 1D barcodes such as EAN-13, UPC-A, Code 128 and Code 39 when the browser has a built-in detector. A QR may contain a URL, Wi-Fi credentials, a vCard contact, mailto, phone, SMS, geo location, an otpauth setup URI or plain text.',
    },
    {
      q: 'Will it open a scanned link automatically?',
      a: 'Never. Opening a link is a button you press. Wi-Fi, contact and plain-text payloads are shown as fields you can copy, and unsafe schemes such as javascript: and data: are refused as links outright.',
    },
  ],
  related: ['qr-code', 'barcode', 'vcard', 'otp-uri'],
  credits: [{ name: 'jsQR', url: 'https://github.com/cozmo/jsQR', license: 'Apache-2.0' }],
  status: 'beta',
  updated: '2026-10-17',
};
