import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'data-uri',
  name: 'Data URI Converter',
  category: 'web',
  summary:
    'Encode text or an image as a data: URI, or decode a data: URI back to text or an image file.',
  description:
    'Turn text into a self-contained data: URL (base64 or percent-encoded) with your chosen MIME type and charset, decode a data: URI back to text, embed an image file as a data: URI, or unpack a data: URI into a downloadable image. Everything happens in this tab.',
  keywords: [
    'data uri',
    'data url',
    'data:text/html',
    'base64 encode',
    'inline file',
    'mhtml',
    'data uri decoder',
    'image to data uri',
    'data uri to image',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  // The tool takes text *and* files, which the generic workbench cannot
  // express, so it opts into the dedicated data URI panel. The options below
  // are what that panel drives — `run()` reads them through `resolveOptions`,
  // so the tool stays usable without the UI.
  panel: 'data-uri',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'text-encode',
      choices: [
        { value: 'text-encode', label: 'Text → data: URI' },
        { value: 'text-decode', label: 'data: URI → text' },
        { value: 'image-encode', label: 'Image file → data: URI' },
        { value: 'image-decode', label: 'data: URI → image file' },
      ],
    },
    {
      key: 'mimeType',
      label: 'MIME type',
      type: 'text',
      default: 'text/plain',
      showWhen: { key: 'mode', value: 'text-encode' },
    },
    {
      key: 'charset',
      label: 'Append ;charset=utf-8',
      type: 'boolean',
      default: true,
      showWhen: { key: 'mode', value: 'text-encode' },
    },
    {
      key: 'encoding',
      label: 'Payload encoding',
      type: 'select',
      default: 'base64',
      choices: [
        { value: 'base64', label: 'base64' },
        { value: 'url', label: 'percent-encoded' },
      ],
      showWhen: { key: 'mode', value: 'text-encode' },
    },
    {
      key: 'wrap',
      label: 'Output wrapper',
      type: 'select',
      default: 'raw',
      choices: [
        { value: 'raw', label: 'Raw data URI' },
        { value: 'css-background', label: 'CSS background' },
        { value: 'html-img', label: 'HTML img' },
      ],
      showWhen: { key: 'mode', value: 'image-encode' },
    },
    {
      key: 'mediaQueryComment',
      label: 'Include media query comment',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'image-encode' },
    },
  ],
  examples: [
    {
      title: 'Inline SVG',
      input: '<svg/>',
      options: { mode: 'text-encode', mimeType: 'image/svg+xml' },
    },
    { title: 'Decode', input: 'data:text/plain,hello%20world', options: { mode: 'text-decode' } },
  ],
  faq: [
    {
      q: 'Why base64 instead of percent-encoding?',
      a: 'base64 grows the payload by ~33% but never needs escaping; percent-encoding is shorter for mostly-ASCII text. Both are valid per RFC 2397.',
    },
    {
      q: 'What happened to “Image to Data URI” and “Data URI to Image”?',
      a: 'Both are now modes of this tool. Their old URLs still work and redirect here, so old links and bookmarks keep working.',
    },
    {
      q: 'Does the data: URI leave my device?',
      a: 'No. Encoding and decoding happen in this tab; nothing is uploaded and the URI never leaves your browser.',
    },
  ],
  related: [  "base64",
  "url-encode",
  "base64-file"],
  status: 'stable',
};
