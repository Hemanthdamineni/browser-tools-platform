import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-organize',
  name: 'Organize PDF Pages',
  category: 'pdf',
  summary:
    'Reorder, rotate, delete and add blank pages to a PDF, then save the new order as a PDF.',
  description:
    'Arrange a PDF the way you want it: drag the page thumbnails into a new order, turn pages, drop the ones you do not need and slip in a blank sheet. The result is saved as a new PDF.',
  keywords: ['pdf', 'organize', 'organise', 'reorder', 'arrange', 'pages', 'rotate', 'blank page'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  // The thumbnail grid (drag, rotate, delete, insert) cannot be expressed by the
  // generic option form, so the tool opts into the dedicated organiser panel
  // (src/components/panels/pdf-organize.astro). The options below are the page
  // plan that panel drives — they are read by `run()` through `resolveOptions`
  // and keep the tool usable without the UI.
  panel: 'pdf-organize',
  options: [
    {
      // Filled in by the organiser panel with the JSON array of planned pages.
      // `all` (the default) keeps every page in its original order.
      key: 'pages',
      label: 'Page plan (JSON)',
      type: 'textarea',
      default: 'all',
    },
    {
      key: 'blankSize',
      label: 'Blank page size',
      type: 'select',
      default: 'a4',
      choices: [
        { value: 'a4', label: 'A4 portrait' },
        { value: 'a4-landscape', label: 'A4 landscape' },
        { value: 'letter', label: 'Letter portrait' },
        { value: 'letter-landscape', label: 'Letter landscape' },
      ],
    },
    {
      key: 'outputName',
      label: 'Output file name',
      type: 'text',
      default: 'organized.pdf',
    },
  ],
  examples: [{ title: 'Organise a document' }],
  faq: [
    {
      q: 'Can I drag the pages into a new order?',
      a: 'Yes — drag a thumbnail, or focus it and use the left and right arrow keys. Every thumbnail also has Move and Rotate buttons, so nothing depends on a mouse.',
    },
    {
      q: 'Does the rotation add to a rotation the page already has?',
      a: 'Yes. The turn you pick is added to the page’s own rotation, so the saved PDF looks exactly like the preview you arranged.',
    },
    {
      q: 'Is the file uploaded anywhere?',
      a: 'No. The thumbnails are drawn with a local PDF renderer and the new file is assembled in a background worker on this device.',
    },
    {
      q: 'Can a page be used twice?',
      a: 'No — every source page can appear only once. Copy a page in your PDF viewer first if you need it twice.',
    },
  ],
  related: ['pdf-merge', 'pdf-split', 'pdf-rotate', 'pdf-delete-pages'],
  credits: [pdfCredit, pdfjsCredit],
  status: 'beta',
};
