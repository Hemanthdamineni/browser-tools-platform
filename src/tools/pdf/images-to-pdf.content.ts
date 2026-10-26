/**
 * Editorial content for the images-to-pdf tool page.
 *
 * Kept out of ``images-to-pdf.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Pages and layout',
      body: 'Choose PNG or JPEG files and each one becomes a page, in the order selected. With Fit to image the page adopts the picture dimensions, so nothing is cropped or padded. A4 or Letter instead places the image on fixed paper, centred, with Automatic orientation turning wide pictures sideways.',
    },
    {
      heading: 'Contain versus cover',
      body: 'On fixed paper, Contain scales the image until it fits inside the printable area and leaves margins. Cover scales it until it fills the area, cropping the overflow. The margin option adds a point-based border on every side, where 72 points equal one inch.',
    },
    {
      heading: 'When to use it',
      body: 'Ideal for turning a phone full of scanned receipts or photographed pages into one shareable document, and for attaching a batch of screenshots to a report without a desktop publishing program.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Only PNG and JPEG decode, and any other file raises an error naming it. The result is a single images.pdf with no text layer, because every page is a rendered image. Building happens in your browser and no file is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Can I mix PNG and JPEG files?',
      a: 'Yes. Pick any number of PNG or JPEG images and they are added in the order shown, one image per page.',
    },
    {
      q: 'What page sizes are available?',
      a: 'Fit to image makes the page match each picture. A4 and Letter place the image on fixed paper, centred, with an optional margin in points where 72 points equal one inch.',
    },
    {
      q: 'Will the PDF contain selectable text?',
      a: 'No. Every page is a rendered image, so there is no text layer to search or copy.',
    },
  ],
} as const;
