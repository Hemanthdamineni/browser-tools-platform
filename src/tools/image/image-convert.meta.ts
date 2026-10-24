import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-convert',
  name: 'Convert Image Format',
  category: 'image',
  summary: 'Convert images between PNG, JPEG, WebP and AVIF in your browser.',
  description:
    'Convert an image to another common format using local browser canvas encoding. The file stays on your device.',
  keywords: ['image converter', 'convert image', 'png to jpg', 'webp converter'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'to',
      label: 'Target format',
      type: 'select',
      default: 'webp',
      choices: ['png', 'jpeg', 'webp', 'avif'].map((value) => ({
        value,
        label: value.toUpperCase(),
      })),
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      help: 'Used by JPEG, WebP and AVIF. PNG ignores it.',
    },
    {
      key: 'background',
      label: 'Background for JPEG',
      type: 'text',
      default: '#ffffff',
      placeholder: '#ffffff',
      help: 'JPEG has no transparency, so transparent areas are filled with this colour.',
    },
  ],
  examples: [
    { title: 'Convert to WebP' },
    { title: 'PNG to JPEG on a white background', options: { to: 'jpeg', quality: 85 } },
    { title: 'Smaller AVIF copies', options: { to: 'avif', quality: 90 } },
  ],
  faq: [
    {
      q: 'Are rotated phone photos straightened?',
      a: 'Yes. Each image is decoded with its EXIF orientation applied, so a portrait photo taken on a phone comes out upright rather than sideways, without you having to rotate it first.',
    },
    {
      q: 'Why did my transparency disappear when I picked JPEG?',
      a: 'JPEG has no alpha channel, so transparent pixels are flattened onto the background colour before encoding. The default is white; enter any 3- or 6-digit hex value to choose a different fill. PNG, WebP and AVIF keep transparency.',
    },
    {
      q: 'Does the quality setting affect every format?',
      a: 'Quality applies to JPEG, WebP and AVIF and is clamped between 10 and 100. PNG is lossless and ignores it entirely, so lowering quality on a PNG changes nothing about the file.',
    },
  ],
  article: [
    {
      heading: 'How the conversion works',
      body: 'Each file you drop in is decoded to an in-memory bitmap with its EXIF orientation already applied, drawn onto a canvas and then encoded in the target format by the browser. You can convert a batch at once; every output keeps the original name with the new extension, and the stats report how many files were converted and the total bytes before and after. Nothing is resized and no metadata panel is offered, so the picture itself is what changes — only its container and compression.',
    },
    {
      heading: 'Which format to pick',
      body: 'PNG is lossless and carries an alpha channel, which makes it right for screenshots, logos and anything with transparent corners, at the cost of size. JPEG compresses photos hardest but has no transparency, so it flattens onto a solid colour. WebP generally beats both for web delivery, keeping alpha while shrinking photographic images, and AVIF compresses further still. Because encoding is done by the browser’s own canvas, the formats you can produce are the ones your browser can write, and an unsupported target reports an error instead of a corrupt file.',
    },
    {
      heading: 'Quality and the JPEG background',
      body: 'The quality slider runs from 10 to 100 and applies to the lossy formats — JPEG, WebP and AVIF — where lower values trade fidelity for size. PNG is lossless and ignores it. The background colour field only matters for JPEG: before drawing an image with transparency, the canvas is filled with that colour, so transparent areas become solid. It accepts a 3- or 6-digit hex value and rejects anything else, which keeps you from silently getting an all-black or invisible fill.',
    },
    {
      heading: 'Practical limits and privacy',
      body: 'Very large images can exceed the canvas size a browser will allocate, and the tool checks the decoded dimensions against that budget before drawing, so you get a clear error rather than a blank result. Animated images are converted as their first frame, and colour profiles are not carried across because a canvas works in plain sRGB. The whole job runs on your device: files are decoded, drawn and re-encoded in the tab, nothing is uploaded, and the page works offline.',
    },
  ],
  related: ['image-compress', 'svg-to-png'],
  status: 'stable',
  updated: '2026-10-16',
};
