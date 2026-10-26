import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';
export const meta: ToolMeta = {
  id: 'pdf-metadata',
  name: 'View / Edit PDF Metadata',
  category: 'pdf',
  summary: 'Inspect document properties or update PDF title, author, subject, keywords and more.',
  description:
    'View the metadata stored in a PDF, then optionally change its document properties. Processing stays in your browser.',
  keywords: ['pdf', 'metadata', 'title', 'author', 'properties', 'inspect'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    { key: 'title', label: 'Title', type: 'text', default: '' },
    { key: 'author', label: 'Author', type: 'text', default: '' },
    { key: 'subject', label: 'Subject', type: 'text', default: '' },
    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },
    { key: 'creator', label: 'Creator', type: 'text', default: '' },
    { key: 'producer', label: 'Producer', type: 'text', default: '' },
    { key: 'clearAll', label: 'Clear all metadata', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'View PDF metadata' },
    { title: 'Set a title', options: { title: 'My document' } },
    { title: 'Strip all metadata', options: { clearAll: true } },
  ],
  faq: [
    {
      q: 'Does viewing a PDF change it?',
      a: 'No. With every property field empty the tool only reads the document and shows the table; no file is produced and the original on disk stays untouched. A new PDF is written only when you fill in at least one property or turn on Clear all metadata.',
    },
    {
      q: 'Which properties can I edit?',
      a: 'Title, Author, Subject, Keywords, Creator and Producer. Keywords are split on commas and trimmed, so a value like invoice, 2026, draft becomes three keywords. Dates and the page count are reported but the PDF page structure itself is never rewritten.',
    },
    {
      q: 'What does the saved file contain?',
      a: 'The output is metadata-updated.pdf, a copy of your document with the document information dictionary replaced. Page content, images and form fields are copied through unchanged, so the result opens exactly like the original.',
    },
    {
      q: 'Does this strip hidden XMP metadata too?',
      a: 'No. It reads and rewrites the standard document-information dictionary — title, author, subject, keywords, creator and producer. Embedded XMP metadata, annotations and outline titles are left untouched, so use a dedicated XMP tool if you need those removed.',
    },
    {
      q: 'Why does the download still include my old metadata?',
      a: 'Clearing a field writes an empty value; a viewer that shows nothing back is behaving correctly. If a property reappears, the file was encrypted or the edit did not commit — check for the load error message rather than a silent partial result.',
    },
  ],
  article: [
    {
      heading: 'What is shown for a PDF',
      body: 'Open any PDF and the tool lists the title, author, subject, keywords, creator, producer, creation and modification dates and the page count. These come straight from the document information dictionary, so what you see is what the file stores, whether or not it was filled in when the document was made.',
    },
    {
      heading: 'A document you are about to send out',
      body: 'Use it before publishing or emailing a file: settle on a real title so viewers and search results show something meaningful, and blank the author or producer when those leak an internal project name or a personal machine name you would rather not share.',
    },
    {
      heading: 'The fields you can set',
      body: 'Six text options cover the editable properties. The keywords field accepts a comma-separated list, and the Clear all metadata switch overrides every field and leaves the document with empty properties. Filling any single field is enough to trigger the download.',
    },
    {
      heading: 'Limits to be aware of',
      body: 'Only the standard document-information fields are touched; embedded XMP metadata, annotations and outline titles are left alone. An encrypted or malformed file fails to load with a clear message rather than a partial result. Nothing else inside the PDF is altered.',
    },
    {
      heading: 'Your PDF never leaves the browser',
      body: 'The document is parsed and rewritten entirely on your device, and the edited file you download is built inside the page. Nothing is uploaded, so document properties and the rest of the PDF stay private and the tool works offline.',
    },
  ],
  related: ['pdf-page-numbers', 'pdf-watermark', 'image-metadata'],
  credits: [pdfCredit],
  status: 'stable',
};
