import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-split',
  name: 'Split PDF',
  category: 'pdf',
  summary: 'Split a PDF into one file per page, per range, or into fixed-size chunks.',
  description:
    'Break a PDF apart in your browser: every page as its own file, custom page ranges, or fixed-size chunks. Multiple results are bundled into a ZIP.',
  keywords: ['pdf', 'split', 'divide', 'ranges', 'chunks', 'extract'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'mode',
      label: 'Split mode',
      type: 'select',
      default: 'every-page',
      choices: [
        { value: 'every-page', label: 'Every page' },
        { value: 'ranges', label: 'Custom ranges' },
        { value: 'fixed-size', label: 'Fixed-size chunks' },
      ],
    },
    {
      key: 'ranges',
      label: 'Ranges',
      type: 'text',
      default: '1-3,5,7-',
      help: 'e.g. 1-3,5,7- (7- means to the end)',
      showWhen: { key: 'mode', value: 'ranges' },
    },
    {
      key: 'size',
      label: 'Pages per file',
      type: 'number',
      default: 10,
      min: 1,
      max: 500,
      showWhen: { key: 'mode', value: 'fixed-size' },
    },
  ],
  examples: [
    { title: 'One file per page' },
    { title: 'Split into ranges', options: { mode: 'ranges', ranges: '1-3,4-' } },
    { title: 'Split into 5-page chunks', options: { mode: 'fixed-size', size: 5 } },
  ],
  article: [
    {
      heading: 'Three ways to choose the split points',
      body: 'Every page turns each sheet into its own part. Custom ranges lets you decide the groups yourself with a comma-separated list, where a trailing hyphen means to the end, so 7- takes page 7 onward. Fixed-size chunks cuts the document every N pages, defaulting to 10; the final part holds whatever is left, so a 23-page file at 5 per file yields five parts and a short tail of three.',
    },
    {
      heading: 'One download or a ZIP',
      body: 'A single group is handed back directly as split.pdf. With more than one, the parts are bundled into split.zip with members named part-01.pdf, part-02.pdf and so on, zero-padded so they sort in page order. Each part is a standalone PDF holding only its pages, and because pages are copied rather than re-rendered, their annotations and layout survive intact.',
    },
    {
      heading: 'Range errors are caught before anything is written',
      body: 'Ranges are validated against the real page count first. A malformed token is refused, and a group starting before page 1, ending past the last page or running backwards is rejected with the offending token and the valid bounds, so a typo cannot silently drop pages. Parsing the source and writing every part happens in this tab with pdf-lib; the file is never uploaded and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'Why a ZIP?',
      a: 'When the split produces more than one file they are bundled into a single ZIP download.',
    },
    {
      q: 'How are the part files named?',
      a: 'Inside the ZIP they are part-01.pdf, part-02.pdf and so on, zero-padded so they sort in the same order as the pages. If the split yields only one group it downloads as split.pdf instead.',
    },
    {
      q: 'What does a trailing hyphen in a range mean?',
      a: 'It means to the end of the document, so 7- collects page 7 through the last page, while 1-3,5,7- makes three separate groups.',
    },
  ],
  related: ['pdf-merge', 'pdf-extract-pages', 'pdf-delete-pages'],
  credits: [pdfCredit],
  status: 'stable',
};
