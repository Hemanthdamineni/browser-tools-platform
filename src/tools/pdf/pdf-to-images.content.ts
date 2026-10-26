/**
 * Editorial content for the pdf-to-images tool page.
 *
 * Kept out of ``pdf-to-images.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What PDF to Images produces',
      body: 'PDF to Images rasterises each chosen page onto an offscreen canvas and hands it back as a PNG, JPEG or WebP. A single page downloads as its own file; several pages are zipped together into pdf-images.zip, with names such as page-001.png so the original order survives.',
    },
    {
      heading: 'When to convert instead of screenshot',
      body: 'It fits turning a slide deck into preview thumbnails, lifting a diagram out of a datasheet, or archiving a scan as pictures someone can open anywhere. Rendering happens page by page, so you can export just the pages you name.',
    },
    {
      heading: 'The options that change the picture',
      body: 'Scale multiplies the page dimensions and is clamped between 1 and 4; the default 2 already doubles a 72 dpi page for a legible screen image. The pages box takes all or a list like 1,3-5. Quality only appears for JPEG, where it runs from 1 to 100 with a default of 90; PNG and WebP ignore it.',
    },
    {
      heading: 'Caveats and where the file stays',
      body: 'The tool needs a browser with OffscreenCanvas and refuses a scale below 1 or above 4, and a damaged or password-protected PDF is reported instead of guessed at. Nothing is uploaded: pdf.js renders inside your browser worker, so the document never leaves the machine.',
    },
  ],
  faq: [
    {
      q: 'Why did I get a ZIP instead of images?',
      a: 'A single selected page downloads as one image file, but two or more are bundled into pdf-images.zip so every page arrives in a single download.',
    },
    {
      q: 'What does the scale option do?',
      a: 'It multiplies page dimensions during rendering and is clamped between 1 and 4. The default of 2 doubles the size, lifting a 72 dpi page to a crisp screen image.',
    },
    {
      q: 'Why is the quality slider hidden?',
      a: 'Quality only applies to JPEG, where it runs from 1 to 100 with a default of 90. PNG is lossless and WebP ignores the value, so the slider stays hidden for them.',
    },
    {
      q: 'Which browsers can render the pages?',
      a: 'Rendering runs on an OffscreenCanvas inside a worker, so an up-to-date browser is required; without that support the tool reports that worker-based PDF rendering is unsupported.',
    },
  ],
} as const;
