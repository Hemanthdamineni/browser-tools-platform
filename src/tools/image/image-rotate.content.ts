/**
 * Editorial content for the image-rotate tool page.
 *
 * Kept out of ``image-rotate.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Rotating and flipping one or many',
      body: 'The accept list is any image and the multiple flag is on, so you can drop a whole folder and every file comes out turned or mirrored. Rotation moves clockwise in 90-degree steps \u2014 90, 180 or 270 \u2014 and the flip option mirrors horizontally, vertically or both. Each output is written with the source name plus "-rotated" and the chosen extension.',
    },
    {
      heading: 'What each option does to the pixels',
      body: 'A quarter turn swaps the canvas width and height (90 and 270) while 180 keeps them. The flip is a mirror about the image centre: horizontal reverses left to right, vertical flips top to bottom, and both rotates 180 with a mirror. Every transform draws about the centre, so a rotated image fills the output canvas with no offset or letterboxing.',
    },
    {
      heading: 'Format and transparency handling',
      body: 'Output format can keep the original or force PNG, JPEG or WebP. That matters for quarter turns, because rotating a rectangle leaves empty corners: PNG and WebP keep them transparent, while JPEG has no alpha and flattens them onto white before rotating. JPEG export also flattens any transparency from the source.',
    },
    {
      heading: 'What the decoder fixes, and privacy',
      body: 'Phone photos carrying EXIF orientation are decoded upright before any transform, so a sideways-stored image does not come out rotated an extra way. The angle is validated before a pixel is touched \u2014 a non-multiple of 90 is rejected, and out-of-range multiples are normalised, so 450 behaves as 90. Decoding, rotating and encoding all happen on a canvas in your browser, so no image is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which way does 90° rotate?',
      a: 'Clockwise, matching how most photo apps label a quarter turn.',
    },
    {
      q: 'Are my images uploaded?',
      a: 'No. Rotation runs on a canvas in your browser and nothing leaves your device.',
    },
    {
      q: 'What about phone photos that look sideways?',
      a: 'EXIF orientation is applied while decoding, so an upright photo stays upright. Exporting to JPEG flattens transparency onto white.',
    },
  ],
} as const;
