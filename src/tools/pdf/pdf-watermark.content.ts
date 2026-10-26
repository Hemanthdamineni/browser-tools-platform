/**
 * Editorial content for the pdf-watermark tool page.
 *
 * Kept out of ``pdf-watermark.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Text stamped onto the pages you list',
      body: 'Type the mark you want, choose pages with all or a list such as 1,3-5 (a trailing dash runs to the last page), and the tool returns watermarked.pdf plus a count of the stamped pages. Listing a page twice draws the mark on it twice, so keep the list free of repeats.',
    },
    {
      heading: 'Placement, angle and transparency in practice',
      body: 'Centered puts one mark in the middle of each page. Tile repeats it on a grid whose spacing grows with the text width and font size, which suits a full-page DRAFT or CONFIDENTIAL pattern. Rotation spans -90 to 90 degrees around each anchor point, and Opacity thins the ink so the original text stays readable — 15% is the default.',
    },
    {
      heading: 'Colour, font and non-Latin text',
      body: 'Colour must be a six-digit hex value like #ff0000; the three-digit shorthand used elsewhere is rejected here. The mark is drawn in the built-in Helvetica Bold, whose WinAnsi encoding covers Western European characters only, so Cyrillic, Greek or CJK text fails rather than rendering as boxes.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'The PDF is loaded and re-saved by pdf-lib inside your browser, with only the selected pages modified and the rest copied through untouched. There is no upload, no server-side copy and no page cap, so a long document costs only the time it takes to save.',
    },
  ],
  faq: [
    {
      q: 'Can I watermark just some pages?',
      a: 'Yes — set Pages to a list or ranges such as 4 or 2,5-9. The word all, or an empty value, selects every page, and a trailing dash like 4- runs to the final page. A number outside the document is an error.',
    },
    {
      q: 'Does the watermark cover the original text?',
      a: 'It is drawn over the page with the opacity you chose, so at the 15% default the content underneath still reads clearly. Raise the opacity towards 100 for a solid block, and switch placement to Tile if a single centered mark is not enough.',
    },
    {
      q: 'Is my PDF uploaded while it is stamped?',
      a: 'No. The document is parsed, watermarked and saved entirely in your browser, so the file never leaves your device.',
    },
  ],
} as const;
