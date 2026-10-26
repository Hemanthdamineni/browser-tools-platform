/**
 * Editorial content for the image-filters tool page.
 *
 * Kept out of ``image-filters.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A live preview on the real pixels',
      body: 'Unlike a CSS filter that only tweaks how the image is drawn on screen, this tool runs the actual pixel pipeline and shows you the result. Brightness, contrast, saturation, grayscale and sepia are applied as colour-matrix math, and sharpen uses an unsharp-mask kernel. What you see in the preview is exactly the pixel data the export writes.',
    },
    {
      heading: 'Compare before and after',
      body: 'Hold or toggle the compare button to flip the preview back to the original image. The unfiltered source is kept in memory, so the comparison is exact — you are not approximating what the filter did.',
    },
    {
      heading: 'Preview scale, full-resolution export',
      body: 'Large photos are previewed on a downscaled canvas so adjusting sliders stays fast, even on a 50-megapixel camera. When you export, the same pipeline is applied to the full-resolution pixels, so the downloaded file keeps every detail of the original.',
    },
    {
      heading: 'On-device and offline',
      body: 'All processing runs locally in your browser tab. The image is decoded, filtered and re-encoded without a single network request, so it works fully offline and nothing you edit leaves your device.',
    },
  ],
  faq: [
    {
      q: 'Is this the same as a CSS filter?',
      a: 'No. A CSS filter changes how the browser draws the image on screen but never touches the pixels. Here the filter is applied to the actual image data, and the export is a real, re-encoded image file.',
    },
    {
      q: 'Does the preview match the export?',
      a: 'Yes. The preview and the export run the exact same pixel pipeline, so the only difference is resolution — large images are previewed scaled down to stay fast, but the export runs at full resolution.',
    },
    {
      q: 'Are my images uploaded anywhere?',
      a: 'No. Every step — decode, filter and encode — happens in your browser. The site works fully offline and nothing leaves your device.',
    },
  ],
} as const;
