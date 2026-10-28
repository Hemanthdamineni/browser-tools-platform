import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'qr-code',
  name: 'QR Code Generator',
  category: 'generators',
  summary: 'Generate QR codes for text, URLs, Wi-Fi, email, SMS and locations as crisp SVG.',
  description:
    'Turn text into a QR code you can download as SVG — for links, Wi-Fi join codes, mailto, SMS, phone numbers or geo locations. Colour, size, margin and error-correction level are yours to tune.',
  keywords: ['qr code', 'qrcode', 'barcode', 'wifi qr', 'svg qr', 'url qr', 'generator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'contentType',
      label: 'Content type',
      type: 'select',
      default: 'text',
      choices: [
        { value: 'text', label: 'Plain text' },
        { value: 'url', label: 'URL' },
        { value: 'wifi', label: 'Wi-Fi' },
        { value: 'email', label: 'Email (mailto:)' },
        { value: 'sms', label: 'SMS (smsto:)' },
        { value: 'geo', label: 'Geo (geo:)' },
        { value: 'tel', label: 'Phone (tel:)' },
      ],
    },
    {
      key: 'wifiPassword',
      label: 'Wi-Fi password',
      type: 'text',
      default: '',
      showWhen: { key: 'contentType', value: 'wifi' },
    },
    {
      key: 'wifiEncryption',
      label: 'Wi-Fi encryption',
      type: 'select',
      default: 'WPA',
      choices: [
        { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
        { value: 'WEP', label: 'WEP' },
        { value: 'nopass', label: 'Open (none)' },
      ],
      showWhen: { key: 'contentType', value: 'wifi' },
    },
    {
      key: 'ecc',
      label: 'Error correction',
      type: 'select',
      default: 'M',
      choices: [
        { value: 'L', label: 'Low (7%)' },
        { value: 'M', label: 'Medium (15%)' },
        { value: 'Q', label: 'Quartile (25%)' },
        { value: 'H', label: 'High (30%)' },
      ],
    },
    { key: 'cellSize', label: 'Module size (px)', type: 'number', default: 6, min: 2, max: 16 },
    { key: 'margin', label: 'Quiet zone (modules)', type: 'number', default: 4, min: 0, max: 8 },
    { key: 'dark', label: 'Dark colour', type: 'text', default: '#000000' },
    { key: 'light', label: 'Light colour', type: 'text', default: '#ffffff' },
  ],
  examples: [
    { title: 'Link', input: 'https://example.com', options: { contentType: 'url' } },
    {
      title: 'Wi-Fi join code',
      input: 'MyNet',
      options: { contentType: 'wifi', wifiPassword: 'secret' },
    },
  ],
  faq: [
    {
      q: 'Why SVG?',
      a: 'SVG scales to any size without blurring, and the file is tiny. Paste it into a design tool or embed it directly in a page.',
    },
    {
      q: 'Which error-correction level should I pick?',
      a: 'M is the usual default. Choose H when the code may be printed small, worn, or partly covered — higher levels let scanners still decode a damaged code.',
    },
  ],
  related: [  "placeholder-svg",
  "data-uri",
  "vcard"],
  credits: [
    {
      name: 'qrcode-generator',
      url: 'https://github.com/kazuhikoarase/qrcode-generator',
      license: 'MIT',
    },
  ],
  status: 'stable',
};
