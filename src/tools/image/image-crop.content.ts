/**
 * Editorial content for the image-crop tool page.
 *
 * Kept out of ``image-crop.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it takes and returns',
      body: 'Upload one or more images and the tool returns cropped copies named <original>-crop.<ext>. In Aspect ratio mode it cuts the largest rectangle of that ratio that fits and positions it with the anchor; in Pixels mode it uses your x, y, width and height. Format keeps the source type, or you can force PNG, JPEG or WebP.',
    },
    {
      heading: 'A concrete use',
      body: 'Turning a batch of uneven screenshots into square avatars: choose 1:1, anchor center, pick JPEG, and every file comes back cropped and re-encoded in one pass.',
    },
    {
      heading: 'What each option changes',
      body: 'anchor only shifts the rectangle within Aspect ratio mode — a left or right anchor pins x, a top or bottom anchor pins y, and center splits the slack evenly. In Pixels mode the rectangle is clamped to the image, and a box that falls entirely outside or has zero size raises an error instead of a blank file. Choosing JPEG flattens transparency onto white because the format has no alpha channel.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'Aspect ratios must be two positive numbers written like 16:9; anything else, such as 16 or 0:1, is rejected. Enormous images are refused up front: each side is limited to about 16,384 px and the total to 100 megapixels so a decode cannot crash the tab. EXIF orientation is honoured, so the crop applies to the upright image.',
    },
    {
      heading: 'Privacy',
      body: 'Your files are decoded and re-encoded entirely on this device; no image is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Does cropping re-encode the image?',
      a: 'Yes. The result is drawn onto a new canvas and encoded again, so it is a fresh copy rather than a metadata edit. PNG and WebP keep transparency; JPEG cannot, so anything transparent is flattened onto white before encoding.',
    },
    {
      q: 'Can I crop several images at once?',
      a: 'Yes. Every selected file is cropped with the same settings and returned in input order, each named after the source with a -crop suffix.',
    },
    {
      q: 'What does the Pixels mode do when my rectangle goes past the edge?',
      a: 'The width and height are trimmed so the rectangle stays inside the image. If the start point is already outside the image, or the resulting width or height works out to zero, the tool reports that the rectangle is outside the image or has zero size instead of producing an empty file.',
    },
  ],
} as const;
