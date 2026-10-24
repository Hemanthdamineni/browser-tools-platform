import type { ToolMeta } from '@/lib/types';
import { fflateCredit, pdfjsCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-to-images',
  name: 'PDF to Images',
  category: 'pdf',
  summary: 'Render selected PDF pages as PNG, JPEG, or WebP images.',
  description:
    'Convert PDF pages into image files locally using your browser worker. Multiple images are bundled into a ZIP download.',
  keywords: ['pdf', 'images', 'png', 'jpeg', 'webp', 'render', 'convert'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'format',
      label: 'Image format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    { key: 'scale', label: 'Scale', type: 'number', default: 2, min: 1, max: 4 },
    {
      key: 'pages',
      label: 'Pages',
      type: 'text',
      default: 'all',
      placeholder: 'all or e.g. 1,3-5',
    },
    {
      key: 'quality',
      label: 'Image quality (%)',
      type: 'range',
      default: 90,
      min: 1,
      max: 100,
      showWhen: { key: 'format', value: 'jpeg' },
    },
  ],
  examples: [
    { title: 'Convert PDF pages to PNG' },
    {
      title: 'Export pages 1 and 3-5 as JPEG',
      options: { format: 'jpeg', scale: 2, pages: '1,3-5', quality: 85 },
    },
    { title: 'High-resolution WebP of page 2', options: { format: 'webp', scale: 4, pages: '2' } },
  ],
  faq: [
    {
      q: 'Why did I get a ZIP instead of images?',
      a: 'A single selected page downloads as one image file, but two or more are bundled into pdf-images.zip so every page arrives in a single download.',
    },
    {
      q: 'What does the scale option do?',
      a: 'It multiplies page dimensions during rendering and is clamped between 1 and 4. The default of 2 doubles the size, lifting a 72 dpi page to a crisp screen image.',
    },
    {
      q: 'Why is the quality slider hidden?',
      a: 'Quality only applies to JPEG, where it runs from 1 to 100 with a default of 90. PNG is lossless and WebP ignores the value, so the slider stays hidden for them.',
    },
    {
      q: 'Which browsers can render the pages?',
      a: 'Rendering runs on an OffscreenCanvas inside a worker, so an up-to-date browser is required; without that support the tool reports that worker-based PDF rendering is unsupported.',
    },
  ],
  article: [
    {
      heading: 'What PDF to Images produces',
      body: 'PDF to Images rasterises each chosen page onto an offscreen canvas and hands it back as a PNG, JPEG or WebP. A single page downloads as its own file; several pages are zipped together into pdf-images.zip, with names such as page-001.png so the original order survives.',
    },
    {
      heading: 'When to convert instead of screenshot',
      body: 'It fits turning a slide deck into preview thumbnails, lifting a diagram out of a datasheet, or archiving a scan as pictures someone can open anywhere. Rendering happens page by page, so you can export just the pages you name.',
    },
    {
      heading: 'The options that change the picture',
      body: 'Scale multiplies the page dimensions and is clamped between 1 and 4; the default 2 already doubles a 72 dpi page for a legible screen image. The pages box takes all or a list like 1,3-5. Quality only appears for JPEG, where it runs from 1 to 100 with a default of 90; PNG and WebP ignore it.',
    },
    {
      heading: 'Caveats and where the file stays',
      body: 'The tool needs a browser with OffscreenCanvas and refuses a scale below 1 or above 4, and a damaged or password-protected PDF is reported instead of guessed at. Nothing is uploaded: pdf.js renders inside your browser worker, so the document never leaves the machine.',
    },
  ],
  related: ['images-to-pdf', 'pdf-extract-text'],
  credits: [pdfjsCredit, fflateCredit],
  status: 'stable',
};
