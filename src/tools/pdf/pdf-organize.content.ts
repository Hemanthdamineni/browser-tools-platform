/**
 * Editorial content for the pdf-organize tool page.
 *
 * Kept out of ``pdf-organize.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the organiser lets you do',
      body: 'This tool takes a PDF and lets you rearrange its pages before saving a new file. Drag the thumbnails into a new order, rotate any page in 90-degree steps, drop pages you do not need, and insert a blank sheet. The result is saved as a fresh PDF that keeps the appearance of the preview you arranged, so what you see is what gets written.',
    },
    {
      heading: 'When to reorganise a PDF',
      body: 'A scanner that fed pages in reverse order, a set of landscape pages that should be portrait for reading on a phone, or a cover sheet you want at the end instead of the front are all reasons to reach for it. It is also how you trim a draft before sending: delete the apology page and the blank tail, rotate the mis-orientated scan, and hand back a clean document.',
    },
    {
      heading: 'Keyboard and mouse both work',
      body: 'Drag a thumbnail to move it, or focus it and use the left and right arrow keys; every thumbnail also carries Move and Rotate buttons, so nothing depends on a mouse. The rotation you pick is added to whatever rotation the page already carries, which is why the saved PDF looks exactly like the thumbnail you arranged rather than a fresh orientation.',
    },
    {
      heading: 'Limits and rules',
      body: 'Every source page can appear exactly once in the output — there is no duplicate, so if you need a page twice, duplicate it in your PDF viewer first. Blank pages are inserted at the size you choose from A4 or letter, in portrait or landscape. The tool never guesses about a half-arranged plan: it reads the page plan you drove and refuses to write anything inconsistent with it.',
    },
    {
      heading: 'Assembled locally',
      body: 'The thumbnails are rendered and the new PDF is assembled in a background worker on your device. No page of your document is uploaded and nothing is stored, so you can reorganise a confidential contract here without it leaving your machine.',
    },
  ],
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
} as const;
