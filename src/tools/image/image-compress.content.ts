/**
 * Editorial content for the image-compress tool page.
 *
 * Kept out of ``image-compress.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What image compression does here',
      body: 'Decode a JPEG, PNG, WebP or any other browser-decodable image, redraw it at an optional capped width, and re-encode it to JPEG, WebP or an automatic pick. Batch input is accepted, each file is written with a -min suffix, and the run reports total original bytes, output bytes and an overall ratio.',
    },
    {
      heading: 'When to shrink an image',
      body: 'Use it to fit photos under an upload form size limit, or trim bulky PNG screenshots to WebP for a web page. Handling several files together makes it practical to prepare a whole folder rather than compressing one image at a time.',
    },
    {
      heading: 'The controls that matter',
      body: 'Quality runs from 10 to 100 percent and sets the encode target. The maximum width downscales while preserving aspect ratio, with zero keeping the original size. Format chooses JPEG or WebP, or Automatic which keeps JPEG as JPEG and switches everything else to WebP.',
    },
    {
      heading: 'Caveats and limits',
      body: 'Source dimensions count against a canvas pixel budget and throw when exceeded. If the re-encoded blob is not smaller than the original, the original is kept instead. Metadata stripping is unavoidable during re-encoding, so disabling the option simply records a warning.',
    },
    {
      heading: 'Nothing is uploaded',
      body: 'Decoding, downscaling, flattening and re-encoding all run on your device through the canvas and image APIs, so your photos never leave the tab and the compressor keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What happens if compression makes the file bigger?',
      a: 'The re-encoded blob is compared with the original and discarded if it is not smaller, so the source file is kept with a warning instead of an inflated result.',
    },
    {
      q: 'Can I keep the camera and GPS metadata?',
      a: 'No. Redrawing through the canvas always drops metadata such as GPS and camera details; turning the strip-metadata switch off only adds a warning explaining it cannot be preserved.',
    },
    {
      q: 'Which formats can I export?',
      a: 'JPEG, WebP, or automatic, which keeps JPEG sources as JPEG and converts everything else to WebP for the smallest result.',
    },
    {
      q: 'Can I compress several images at once?',
      a: 'Yes. The tool accepts multiple files and reports the total original and output bytes with an overall ratio.',
    },
  ],
} as const;
