import type { ToolMeta } from '@/lib/types';
import { pdfjsCredit } from './shared';

export const meta: ToolMeta = {
  id: 'pdf-extract-text',
  name: 'Extract PDF Text',
  category: 'pdf',
  summary: 'Extract selectable text from every page of a PDF.',
  description:
    'Read text content from a PDF locally in your browser and display it page by page. Scanned pages without an OCR text layer produce no extracted text.',
  keywords: ['pdf', 'extract', 'text', 'copy', 'content'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  examples: [
    { title: 'Extract text from a PDF' },
    { title: 'Copy clauses out of a contract' },
    { title: 'Pull a report into a text editor' },
  ],
  faq: [
    {
      q: 'Why is a scanned page empty?',
      a: 'A scan stores pixels, not letters. Extraction reads the text layer that a born-digital PDF carries, so a page with no such layer yields no extractable text and the tool warns it may need OCR.',
    },
    {
      q: 'What does “(no extractable text)” mean?',
      a: 'It is the cell shown for a page whose text layer was empty or could not be read, so that page still appears in the table instead of vanishing silently.',
    },
    {
      q: 'Is the PDF uploaded anywhere?',
      a: 'No. The file is parsed locally by pdf.js in your browser, so it is never uploaded, and the tool keeps working with the network switched off.',
    },
  ],
  article: [
    {
      heading: 'What Extract PDF Text returns',
      body: 'Extract PDF Text opens the file with pdf.js and pulls the selectable text out of every page, returning a two-column Page and Text table plus character and page counts. It reads the text layer already stored in the document, so a born-digital export from Word or LaTeX comes back as clean prose, while whitespace is tidied: trailing spaces on a line are dropped and runs of three or more line breaks collapse to two.',
    },
    {
      heading: 'When to use it',
      body: 'Use it when you want to quote a clause from a contract, drop a report into an editor, or search a long PDF without retyping. There are no settings to configure, so the only decision left is what to do with the text afterwards.',
    },
    {
      heading: 'Limits and error handling',
      body: 'A scanned page has pixels but no text layer, so its cell reads no extractable text and, when nothing at all is found, the run warns that the PDF may need OCR. Corrupt or password-protected files stop with a plain message rather than a stack trace.',
    },
    {
      heading: 'Where your file stays',
      body: 'Nowhere. The PDF is parsed by a local worker in your browser and no page, byte or filename is uploaded; the tool keeps working with the network switched off.',
    },
  ],
  related: ['pdf-to-images', 'pdf-metadata', 'pdf-extract-pages'],
  credits: [pdfjsCredit],
  status: 'stable',
};
