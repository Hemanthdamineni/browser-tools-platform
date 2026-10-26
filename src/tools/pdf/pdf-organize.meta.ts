import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './credits';
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
  examples: [
    { title: 'Organise a document' },
    {
      title: 'Rotate page one and add a letter blank',
      options: {
        pages: '[{"source":1,"rotate":90},{"blank":true,"size":"letter"}]',
        blankSize: 'letter',
      },
    },
    {
      title: 'Reverse a two-page scan',
      options: { pages: '[{"source":2},{"source":1}]', outputName: 'reversed.pdf' },
    },
  ],
  related: ['pdf-merge', 'pdf-split', 'pdf-rotate', 'pdf-delete-pages'],
  credits: [pdfCredit, pdfjsCredit],
  status: 'beta',
};
