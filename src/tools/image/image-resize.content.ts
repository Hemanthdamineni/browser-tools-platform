/**
 * Editorial content for the image-resize tool page.
 *
 * Kept out of ``image-resize.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Formats and output names',
      body: 'Takes one or more PNG, JPEG or WebP images and scales each to a new size, either by a percentage or to explicit width and height, returning resized copies as downloads. Output files are named like photo-640x480.jpg and keep their original format unless you choose PNG, JPEG or WebP explicitly. EXIF orientation is applied while decoding, so a portrait photo is not rotated sideways.',
    },
    {
      heading: 'When to use it',
      body: 'Use it to shrink large photos before emailing or uploading them, or to force an asset to exact pixel dimensions for a web layout. Batch mode accepts many files at once and gives each the same sizing rules, which suits normalizing a folder of product shots before publishing.',
    },
    {
      heading: 'The sizing modes',
      body: 'Fit keeps the aspect ratio inside your width and height. Fill crops to cover that box, exact forces the raw dimensions and can distort, percent scales both axes by the same factor, and max-width or max-height cap one axis while scaling the other. Defaults are 800 by 600 pixels and 50 percent. The upscale toggle stops small images from being enlarged unless you turn it on.',
    },
    {
      heading: 'Limitations',
      body: 'Dimensions are clamped to 1 to 8192 pixels and percent to 1 to 400. A per-canvas memory budget rejects images that would blow out available memory. JPEG output flattens transparency onto white and exposes a quality slider from 10 to 100 percent, defaulting to 90.',
    },
    {
      heading: 'Privacy',
      body: 'All decoding, scaling and encoding happen in the browser tab. Images never leave the device and the tool works offline.',
    },
  ],
  faq: [
    { q: 'Are images uploaded?', a: 'No. Images are processed locally in your browser.' },
    {
      q: 'Does it respect photo orientation?',
      a: 'Yes — EXIF orientation is applied while decoding so portrait photos are not rotated.',
    },
    {
      q: 'Does resizing change the file type?',
      a: 'Only if you pick an output format. The default keeps the original format; choosing PNG, JPEG or WebP converts every result, and JPEG exposes a quality setting.',
    },
  ],
} as const;
