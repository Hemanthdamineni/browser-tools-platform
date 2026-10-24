import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-delete-pages',
  name: 'Delete Pages',
  category: 'pdf',
  summary: 'Remove selected pages from a PDF and download the trimmed document.',
  description:
    'Delete pages (as a list or ranges) from a PDF right in your browser. The remaining pages keep their original order.',
  keywords: ['pdf', 'delete', 'remove', 'pages', 'trim'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'pages',
      label: 'Pages to delete',
      type: 'text',
      default: '2,4',
      placeholder: 'e.g. 2,4 or 3-6',
    },
  ],
  examples: [
    { title: 'Delete pages 2 and 4', options: { pages: '2,4' } },
    { title: 'Delete a range', options: { pages: '3-6' } },
    { title: 'Delete from page 5 to the end', options: { pages: '5-' } },
  ],
  article: [
    {
      heading: 'Removing pages and keeping the rest',
      body: 'Open a PDF, name the pages you want gone, and the tool returns a new document with exactly those pages removed. The remaining pages keep their original order and content — nothing is re-rendered, so text stays selectable and images keep their resolution. The result arrives as trimmed.pdf ready to download.',
    },
    {
      heading: 'How to name the pages',
      body: 'The page option takes a comma-separated list of numbers and ranges: "2,4" removes two pages, "3-6" removes a run, and "5-" removes from page five to the end. Ranges outside the document are rejected with the real page count in the message rather than being silently clamped, so a typo cannot quietly delete the wrong section.',
    },
    {
      heading: 'The one thing it will not do',
      body: 'It refuses to delete every page, because a PDF must contain at least one. If the selection you entered covers the whole document the run stops with a clear message instead of producing a broken file. Duplicate page numbers in the list are collapsed first, so "2,2,4" is treated as "2,4".',
    },
    {
      heading: 'A typical use',
      body: 'A signed contract arrives as one PDF with a cover sheet and a trailing appendix you must not forward. Enter the cover page and the appendix range, and the download is the middle section alone, with the original pages untouched on your disk because the tool never writes back to the file you opened.',
    },
    {
      heading: 'The document stays local',
      body: 'The PDF is parsed and rewritten in this tab with pdf-lib, and no page data is uploaded. That matters for contracts, invoices and anything with a name or an account number on it — the file never leaves your machine, and the tool works offline after loading.',
    },
  ],
  faq: [
    {
      q: 'Can I remove pages I only know by range?',
      a: 'Yes. Use a range such as 3-6, or leave the end open with 5- to go to the last page. Several pages and ranges can be combined in one comma-separated list, for example "1,4-6,9".',
    },
    {
      q: 'Does it change the pages that stay?',
      a: 'No. Pages are removed from the document structure rather than re-rendered, so the surviving pages keep their original text, fonts and images at full quality.',
    },
    {
      q: 'What happens if I paste a number bigger than the document?',
      a: 'The run stops with a message quoting the real page range, for example 1–12. Nothing is deleted, so you can correct the list and try again.',
    },
  ],
  related: ['pdf-extract-pages', 'pdf-split', 'pdf-rotate'],
  credits: [pdfCredit],
  status: 'stable',
};
