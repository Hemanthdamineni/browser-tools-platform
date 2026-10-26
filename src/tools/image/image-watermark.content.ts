/**
 * Editorial content for the image-watermark tool page.
 *
 * Kept out of ``image-watermark.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Text or a logo, one image or a batch',
      body: 'In text mode you type the words to stamp and choose a colour; in logo mode you supply an image, which the panel rasterises on your device before it is drawn. Either way you can process a whole batch in one run, and every output is saved as the original name with -watermarked and the new extension. The whole watermark is drawn on a canvas at the source’s own resolution, so a mark placed on a small photo looks proportionally the same on a large scan — nothing is upscaled and nothing is downscaled to fit.',
    },
    {
      heading: 'Sizing, positioning and the tiled mark',
      body: 'Text size is a percentage of the image’s short edge, so the same setting reads consistently across differently shaped pictures, and a logo’s width is a percentage of the image width with the height scaled to keep its aspect. The position picker offers the nine anchor points of a grid, with a margin set as another percentage of the short edge. Turning on the tiled option ignores position and margin and repeats the mark across the whole picture at a chosen spacing and angle, which is the pattern you want to keep an entire photo from being cleaned up.',
    },
    {
      heading: 'Opacity, output format and the JPEG flatten',
      body: 'Opacity slides the whole mark between invisible and solid by setting the canvas global alpha. The output format can be the source’s own, or PNG, JPEG or WebP; PNG and WebP keep transparency, while a JPEG output has no alpha channel so transparent pixels are flattened onto white before anything is drawn, so the result never comes out black. Every option is validated before a single pixel is touched, so a bad colour, an out-of-range size or a missing logo fails fast with a message naming the field rather than a half-written file.',
    },
    {
      heading: 'Where the pixels are produced',
      body: 'All of it runs inside the browser. The source files are decoded, the logo is turned back into bytes from the data URL the panel supplies, and the watermark is drawn and re-encoded on a canvas in this tab — no image is uploaded and the page makes no network request, so the marked copies stay as private as the originals. Very large sources are checked against the canvas size a browser will allocate, and a logo that will not decode is reported before any file is written.',
    },
  ],
  faq: [
    {
      q: 'Are my images uploaded to a server?',
      a: 'No. Every pixel is processed on a canvas inside your browser, in a background worker, and nothing is sent anywhere.',
    },
    {
      q: 'How does the font size scale?',
      a: 'Font size is a percentage of the image’s short edge, so a watermark set on a small photo looks the same on a large one.',
    },
    {
      q: 'Can I use an SVG logo?',
      a: 'Yes. The panel rasterises SVG (and PNG/JPEG) on your device before stamping it, because canvas drawing of SVG needs an <img> step.',
    },
    {
      q: 'What happens to transparency?',
      a: 'PNG and WebP keep it. JPEG has no alpha channel, so transparent pixels are flattened onto white before the watermark is drawn.',
    },
  ],
} as const;
