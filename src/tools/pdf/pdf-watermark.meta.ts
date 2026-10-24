import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-watermark',
  name: 'Watermark PDF',
  category: 'pdf',
  summary: 'Overlay translucent text on selected PDF pages as a centered or tiled watermark.',
  description:
    'Mark PDF pages with a text watermark. Choose its opacity, angle, font size, colour, pages and centered or tiled placement.',
  keywords: ['pdf', 'watermark', 'stamp', 'overlay', 'confidential'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    { key: 'text', label: 'Watermark text', type: 'text', default: 'CONFIDENTIAL' },
    { key: 'opacity', label: 'Opacity (%)', type: 'range', default: 15, min: 5, max: 100 },
    {
      key: 'rotation',
      label: 'Rotation (degrees)',
      type: 'number',
      default: 45,
      min: -90,
      max: 90,
    },
    { key: 'fontSize', label: 'Font size', type: 'number', default: 48, min: 8, max: 144 },
    { key: 'color', label: 'Colour (hex)', type: 'text', default: '#ff0000' },
    {
      key: 'pages',
      label: 'Pages',
      type: 'text',
      default: 'all',
      placeholder: 'all or e.g. 1,3-5',
    },
    {
      key: 'position',
      label: 'Placement',
      type: 'select',
      default: 'center',
      choices: [
        { value: 'center', label: 'Centered' },
        { value: 'tile', label: 'Tile across page' },
      ],
    },
  ],
  article: [
    {
      heading: 'Text stamped onto the pages you list',
      body: 'Type the mark you want, choose pages with all or a list such as 1,3-5 (a trailing dash runs to the last page), and the tool returns watermarked.pdf plus a count of the stamped pages. Listing a page twice draws the mark on it twice, so keep the list free of repeats.',
    },
    {
      heading: 'Placement, angle and transparency in practice',
      body: 'Centered puts one mark in the middle of each page. Tile repeats it on a grid whose spacing grows with the text width and font size, which suits a full-page DRAFT or CONFIDENTIAL pattern. Rotation spans -90 to 90 degrees around each anchor point, and Opacity thins the ink so the original text stays readable — 15% is the default.',
    },
    {
      heading: 'Colour, font and non-Latin text',
      body: 'Colour must be a six-digit hex value like #ff0000; the three-digit shorthand used elsewhere is rejected here. The mark is drawn in the built-in Helvetica Bold, whose WinAnsi encoding covers Western European characters only, so Cyrillic, Greek or CJK text fails rather than rendering as boxes.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'The PDF is loaded and re-saved by pdf-lib inside your browser, with only the selected pages modified and the rest copied through untouched. There is no upload, no server-side copy and no page cap, so a long document costs only the time it takes to save.',
    },
  ],
  examples: [
    { title: 'Add a confidential watermark' },
    { title: 'Tile a DRAFT mark across every page' },
    { title: 'Stamp only page 1 at higher opacity' },
  ],
  faq: [
    {
      q: 'Can I watermark just some pages?',
      a: 'Yes — set Pages to a list or ranges such as 4 or 2,5-9. The word all, or an empty value, selects every page, and a trailing dash like 4- runs to the final page. A number outside the document is an error.',
    },
    {
      q: 'Does the watermark cover the original text?',
      a: 'It is drawn over the page with the opacity you chose, so at the 15% default the content underneath still reads clearly. Raise the opacity towards 100 for a solid block, and switch placement to Tile if a single centered mark is not enough.',
    },
    {
      q: 'Is my PDF uploaded while it is stamped?',
      a: 'No. The document is parsed, watermarked and saved entirely in your browser, so the file never leaves your device.',
    },
  ],
  related: ['pdf-page-numbers', 'pdf-metadata'],
  credits: [pdfCredit],
  status: 'stable',
};
