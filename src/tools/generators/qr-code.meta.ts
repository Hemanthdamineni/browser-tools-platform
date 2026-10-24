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
    {
      title: 'Printed geo sticker with high error correction',
      input: 'geo:48.8584,2.2945',
      options: { contentType: 'geo', ecc: 'H', cellSize: 8, margin: 2, dark: '#1a1a1a' },
    },
  ],
  article: [
    {
      heading: 'What it does',
      body: 'Type a string and get a QR code back as an SVG data URI, shown inline and saved as qr.svg. The content-type option shapes the payload: plain text or a URL pass through, Wi-Fi builds WIFI:T:…;S:…;P:…;; with special characters escaped, and email, sms, geo and tel prefix mailto:, smsto:, geo: or tel:. Stats report the module grid, the pixel size and the level used.',
    },
    {
      heading: 'When to use it',
      body: 'Printing a code for the office network is the classic case: choose Wi-Fi, enter the network name and password, then drop the SVG into a label. The vector file scales to any print size.',
    },
    {
      heading: 'Tuning the output',
      body: 'Error correction trades capacity for resilience: L holds the most data and H the least, but H survives scuffs and partial coverage. Module size sets pixels per square from 2 to 16, the quiet zone sets the white border from 0 to 8 modules, and the dark and light fields take any hex colour from #rgb to #rrggbbaa.',
    },
    {
      heading: 'Limits',
      body: 'The payload must fit a single code; long text raises an error suggesting you shorten it or lower the error-correction level. Colour fields reject anything that is not a hex value, and there is no option to overlay a centre logo on the code.',
    },
    {
      heading: 'Privacy',
      body: 'The code is generated in this tab with no network call, so nothing you type is uploaded. Keep in mind that a Wi-Fi payload is readable by anyone who scans the image, so treat the SVG like the password itself.',
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
    {
      q: 'How do I make the code bigger?',
      a: 'Raise the module size (2 to 16 px per square) or the quiet zone (0 to 8 modules). The stats line reports the final pixel dimensions, and as the output is SVG you can also scale it later without loss.',
    },
  ],
  related: ['placeholder-svg', 'data-uri', 'vcard'],
  credits: [
    {
      name: 'qrcode-generator',
      url: 'https://github.com/kazuhikoarase/qrcode-generator',
      license: 'MIT',
    },
  ],
  status: 'stable',
};
