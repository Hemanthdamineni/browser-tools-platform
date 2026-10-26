/**
 * Editorial content for the data-uri tool page.
 *
 * Kept out of ``data-uri.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The four directions of the converter',
      body: 'This tool turns text into a data: URL or back, and does the same for images. The four modes are text to a data: URI, a data: URI back to text, an image file into a data: URI, and a data: URI into a downloadable image file. Image encoding also writes a text file of the result.',
    },
    {
      heading: 'When to inline a resource',
      body: 'Reach for it when you want a page or an email to need no separate request: an SVG sprite, a small logo or a font embedded in a single HTML file, or an image placed in a CSS background rule. Decoding unpacks a pasted data: URI into plain text or an image file.',
    },
    {
      heading: 'MIME type, encoding and wrapper',
      body: 'Mode sets the direction. For text, mimeType declares the type, charset appends ;charset=utf-8, and encoding picks base64 or percent. For images, wrap chooses a raw URI, a CSS background rule or an HTML img tag, and mediaQueryComment adds an explanatory comment above it.',
    },
    {
      heading: 'The 25 MB image ceiling',
      body: 'Image encoding is capped at 25 MB, because base64 runs about a third larger than the source file. Base64 needs no escaping while percent-encoding is shorter for mostly-ASCII text. A malformed payload is an error rather than a guess, and the tool requires exactly one image file.',
    },
    {
      heading: 'Where the encoding happens',
      body: 'Encoding and decoding happen entirely in this tab. Nothing is uploaded, no request is made for the URI or its contents, and the page keeps working offline once it has loaded.',
    },
  ],
  faq: [
    {
      q: 'Why base64 instead of percent-encoding?',
      a: 'base64 grows the payload by ~33% but never needs escaping; percent-encoding is shorter for mostly-ASCII text. Both are valid per RFC 2397.',
    },
    {
      q: 'What happened to “Image to Data URI” and “Data URI to Image”?',
      a: 'Both are now modes of this tool. Their old URLs still work and redirect here, so old links and bookmarks keep working.',
    },
    {
      q: 'Does the data: URI leave my device?',
      a: 'No. Encoding and decoding happen in this tab; nothing is uploaded and the URI never leaves your browser.',
    },
  ],
} as const;
