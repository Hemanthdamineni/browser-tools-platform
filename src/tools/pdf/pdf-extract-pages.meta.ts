import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-extract-pages',
  name: 'Extract Pages',
  category: 'pdf',
  summary: 'Pull selected pages out of a PDF into a new document.',
  description:
    'Copy chosen pages (as a list or ranges, in any order) from a PDF into a single new PDF file, right in your browser.',
  keywords: ['pdf', 'extract', 'pages', 'select', 'subset'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'pages',
      label: 'Pages to extract',
      type: 'text',
      default: '1,3,5-7',
      placeholder: 'e.g. 5,1 or 1-3',
    },
  ],
  examples: [
    { title: 'Extract pages 5 and 1', options: { pages: '5,1' } },
    { title: 'Extract a page range', options: { pages: '1-3' } },
    { title: 'Mix list and range', options: { pages: '3,5-7' } },
  ],
  article: [
    {
      heading: 'The pages field takes lists and ranges',
      body: 'The Pages to extract field accepts a comma-separated list of single numbers and hyphenated ranges, in any order, so 5,1 and 1-3 both work. Page numbers are 1-based, and a range such as 5-7 copies every page from 5 through 7. There is no open-ended shorthand, so a trailing-dash form like 7- is rejected; write the final page number explicitly. Selection is checked against the source before anything is written, and a number beyond the last page aborts the run with an error rather than producing a partial file.',
    },
    {
      heading: 'You can reorder while you extract',
      body: 'Pages are copied in exactly the order you list them, so the tool subsets and reorders in one pass. Typing 9,1 yields a two-page document with page 9 first and page 1 second. The result is always one new PDF named extracted.pdf, holding only the chosen pages, which often makes it much smaller than the original — handy before emailing a single chapter of a long report. Duplicates are allowed, so 4,4 outputs page 4 twice if you want it.',
    },
    {
      heading: 'Everything stays in the browser',
      body: 'The document is parsed and rebuilt on this device with pdf-lib, so the file is never uploaded and the page keeps working once offline. Because only the selected pages are copied, unrelated content and attachments elsewhere in the original are left behind. Your source file on disk is untouched: the tool reads it and hands back a separate download.',
    },
  ],
  faq: [
    {
      q: 'Can I extract pages in a different order?',
      a: 'Yes. The output follows the order you type, so 9,1 places page 9 first and page 1 second.',
    },
    {
      q: 'Does a range support an open end such as 5-?',
      a: 'No. Write the final page explicitly, for example 5-12; open-ended ranges are not accepted here.',
    },
    {
      q: 'What happens if I name a page that does not exist?',
      a: 'The run stops with an error naming the bad range and the valid 1 to page-count bounds, so you never get a silently truncated PDF.',
    },
  ],
  related: ['pdf-split', 'pdf-delete-pages', 'pdf-merge'],
  credits: [pdfCredit],
  status: 'stable',
};
