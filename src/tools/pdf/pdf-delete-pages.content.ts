/**
 * Editorial content for the pdf-delete-pages tool page.
 *
 * Kept out of ``pdf-delete-pages.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Removing pages and keeping the rest',
      body: 'Open a PDF, name the pages you want gone, and the tool returns a new document with exactly those pages removed. The remaining pages keep their original order and content — nothing is re-rendered, so text stays selectable and images keep their resolution. The result arrives as trimmed.pdf ready to download.',
    },
    {
      heading: 'How to name the pages',
      body: 'The page option takes a comma-separated list of numbers and ranges: "2,4" removes two pages, "3-6" removes a run, and "5-" removes from page five to the end. Ranges outside the document are rejected with the real page count rather than silently clamped, so a typo cannot quietly delete the wrong section.',
    },
    {
      heading: 'The one thing it will not do',
      body: 'It refuses to delete every page, because a PDF must contain at least one. If the selection covers the whole document the run stops with a clear message instead of producing a broken file. Duplicate page numbers are collapsed first, so "2,2,4" is treated as "2,4".',
    },
    {
      heading: 'A typical use',
      body: 'A signed contract arrives as one PDF with a cover sheet and a trailing appendix you must not forward. Enter the cover page and the appendix range, and the download is the middle section alone. The original file on your disk is never touched, because the tool does not write back to it.',
    },
    {
      heading: 'The document stays local',
      body: 'The PDF is parsed and rewritten in this tab with pdf-lib, and no page data is uploaded. That matters for contracts, invoices and anything with a name or an account number on it — the file never leaves your machine.',
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
} as const;
