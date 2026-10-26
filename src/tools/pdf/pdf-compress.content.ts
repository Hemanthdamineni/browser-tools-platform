/**
 * Editorial content for the pdf-compress tool page.
 *
 * Kept out of ``pdf-compress.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Where the size goes',
      body: 'Most of a PDF\u2019s weight is its embedded raster pictures, so compression re-encodes those images and rebuilds the file. The report shows original and compressed sizes, the bytes and percent saved, how many images were re-encoded and left alone, and how many unused objects were removed. Text and vector artwork are rebuilt intact.',
    },
    {
      heading: 'The quality presets',
      body: 'Light only rebuilds the file and leaves every picture untouched. Balanced downsamples pictures whose longest side is over 1600 pixels to JPEG at 75 percent quality. Strong pushes harder, downsampling anything over 1100 pixels to 55 percent. Custom sets the longest image side (200 to 6000 pixels) and the JPEG quality yourself, trading visible quality for smaller bytes.',
    },
    {
      heading: 'How each image is decided on',
      body: 'Every picture is inspected first: only raster formats the tool can actually re-encode are attempted, and a re-encoded stream is kept only when it is genuinely smaller than the original \u2014 an already-tight JPEG, or one that recompresses larger, is left as-is and counted in the skipped column with a reason.',
    },
    {
      heading: 'When you get your original back',
      body: 'If compression would not help, you receive the original bytes unchanged with a warning that the PDF is already optimised, and if a structural cleanup changes the document the tool falls back to a straight rebuild. The metadata and output-name options strip document metadata and set the download name. Since pdf-lib cannot re-compress text or vector artwork, nor transcode JPEG 2000, CCITT fax or transparency masks, those parts stay as they are. Everything runs in a Web Worker, so the file never leaves your browser.',
    },
  ],
  faq: [
    {
      q: 'Is my PDF uploaded anywhere?',
      a: 'No. The whole process runs in a Web Worker on your device; the file never leaves your browser.',
    },
    {
      q: 'What if the result is bigger?',
      a: 'You get the original file back untouched and a note saying compression would not have helped.',
    },
    {
      q: 'Why did the size barely change?',
      a: 'pdf-lib can rebuild streams and re-encode raster pictures, but it cannot re-compress text or vector artwork, and it cannot transcode JPEG 2000, CCITT fax or transparency masks.',
    },
  ],
} as const;
