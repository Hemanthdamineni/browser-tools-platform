/**
 * Editorial content for the pdf-rotate tool page.
 *
 * Kept out of ``pdf-rotate.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Rotation that adds to what is there',
      body: 'Pick a page range \u2014 all, a single number like 4, or a list such as 1,3-5 \u2014 and an angle of 90, 180 or 270. The turn is added to any rotation the pages already carry, so a page already 90 degrees clockwise becomes 180 after another 90, and the stored rotation stays under 360. The report lists the total page count and how many were actually rotated.',
    },
    {
      heading: 'When you would use it',
      body: 'The classic case is a scanned contract or phone-captured document where some sheets came in sideways or upside down while the rest are upright. Instead of re-scanning, select just the wrong pages and bring them into line. It is also how you force a portrait document to landscape for a wide screen.',
    },
    {
      heading: 'The page selection syntax',
      body: 'The pages box accepts all, a single page, a comma-separated list, or ranges joined with a hyphen, so 1,3-5 means page one plus pages three to five. Selection is validated against the real page count, and rotation applies only to the pages you named, with everything else written through untouched.',
    },
    {
      heading: 'A structural, not a pixel, operation',
      body: 'Unlike image rotation, this never re-renders the page: it rewrites the PDF\u2019s page rotation entry with pdf-lib, keeping text, links, annotations and form fields intact because the content stream is not touched. The rotated copy comes back as rotated.pdf. The file is read and written in this browser tab, so nothing is uploaded and a confidential document stays on your device.',
    },
  ],
  faq: [
    {
      q: 'What does "rotated" mean for a page that is already turned?',
      a: 'The selected angle is added to whatever rotation the page already has, and the sum is normalised to a value below 360. So a page already at 90 becomes 180 when you apply another 90, not a confusing duplicate.',
    },
    {
      q: 'Does rotating re-render the content?',
      a: 'No. The rotation is stored as a page attribute and the content stream is untouched, so text stays selectable and links and form fields keep working.',
    },
    {
      q: 'What happens if I give an invalid page range?',
      a: 'The selection is checked against the actual page count and a bad range or an out-of-bounds page is rejected with an error before anything is written, so you cannot accidentally corrupt the file.',
    },
  ],
} as const;
