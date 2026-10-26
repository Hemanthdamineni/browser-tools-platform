/**
 * Editorial content for the pdf-redact tool page.
 *
 * Kept out of ``pdf-redact.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How a redaction is planned',
      body: 'Mark rectangles on a page preview, and the panel writes them into the plan as JSON: an array of page entries whose regions are x, y, w and h in percent of the page. Each entry needs a whole page number; regions are clamped into the page and merged per page.',
    },
    {
      heading: 'Why a black box is not enough',
      body: 'Drawing a dark rectangle in an editor leaves the text layer intact, so anyone can select the words underneath. Flattening the marked pages to images and burning the boxes in opaque black destroys that layer, which is why redacted pages lose searchable text while untouched pages keep theirs.',
    },
    {
      heading: 'Scale and output name',
      body: 'The scale option sets rendered pixels per PDF point, from 1 to 4, with 2 as the default — higher is sharper but heavier. Output name gives the exported copy a label you choose instead of the default redacted.pdf.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'The change cannot be undone, so keep the original. At least one rectangle is required, and a plan with no usable regions is rejected. Rasterising needs a browser with OffscreenCanvas, and everything runs on your device with no uploads.',
    },
  ],
  faq: [
    {
      q: 'Is a black box over the text enough to redact it?',
      a: 'No. Covering words with a dark rectangle is reversible — the text layer underneath is still in the file, so anyone can select or copy it. Real redaction flattens the covered pages to images and paints the boxes in, destroying the underlying text entirely. That is what this tool does.',
    },
    {
      q: 'What happens to the pages I redact?',
      a: 'They are rasterised to images and the boxes are burned in. That means they lose their text layer — you cannot search or select text on those pages any more. Pages you do not touch keep their original searchable text.',
    },
    {
      q: 'Is the redaction reversible?',
      a: 'No. The covered pages are flattened to pixels and the boxes painted over them in opaque black. The original content is gone, so nothing can restore it. Always keep a copy of the original file before redacting.',
    },
    {
      q: 'Does the file leave my device?',
      a: 'No. Everything — rendering the pages, burning the boxes and rebuilding the PDF — happens in your browser.',
    },
  ],
} as const;
