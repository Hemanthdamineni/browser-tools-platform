/**
 * Editorial content for the image-strip-metadata tool page.
 *
 * Kept out of ``image-strip-metadata.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What gets removed and what stays',
      body: 'The tool rewrites a JPEG, PNG or WebP and drops the metadata segments inside it: EXIF (including GPS), XMP, IPTC, text chunks and comments. The compressed image data itself is copied byte-for-byte, so the pixels and their quality are untouched — this is a lossless strip, not a re-encode.',
    },
    {
      heading: 'Keeping the colour profile',
      body: 'An ICC colour profile (JPEG APP2, PNG iCCP, WebP ICCP) describes how colours are interpreted rather than who took the photo, so it is kept by default. Turning the option off removes it too, and the tool warns that colours may then shift slightly.',
    },
    {
      heading: 'Why a photo can still look rotated',
      body: 'Many cameras store the orientation as an EXIF tag instead of rotating the pixels. When that EXIF block is removed the file shows its raw orientation, so some viewers appear to rotate the photo; the tool flags this in a warning. Rotate the image first if the arrangement matters.',
    },
    {
      heading: 'Formats, comments and batch use',
      body: 'JPEG, PNG and WebP are detected by their magic bytes, so a mislabelled file is still handled correctly. JPEG comment segments are removed by default because they often hold device notes; APP0/JFIF and APP14 Adobe markers are kept since they affect rendering. GIF, BMP, TIFF, AVIF and HEIC are not supported and must be converted first, and several files strip in one pass.',
    },
    {
      heading: 'Nothing is uploaded',
      body: 'Parsing and rewriting happen entirely in your browser, so the files never leave your device.',
    },
  ],
  faq: [
    {
      q: 'Is stripping really lossless?',
      a: 'Yes. The compressed image data (JPEG scan, PNG IDAT or WebP image chunk) is copied byte-for-byte. Only metadata segments are dropped, so image quality never changes.',
    },
    {
      q: 'Why does my photo look rotated afterwards?',
      a: 'Many cameras store the orientation in an EXIF tag instead of rotating the pixels. Once that tag is removed, viewers show the raw orientation. Rotate the image first if that matters.',
    },
    {
      q: 'Which formats are supported?',
      a: 'JPEG, PNG and WebP. GIF, BMP, AVIF, TIFF and HEIC are not supported — convert them first with the Image Converter.',
    },
    {
      q: 'Is anything uploaded?',
      a: 'No. Parsing and rewriting happen entirely in your browser; the files never leave your device.',
    },
  ],
} as const;
