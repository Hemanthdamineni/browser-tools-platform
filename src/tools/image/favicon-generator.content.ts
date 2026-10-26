/**
 * Editorial content for the favicon-generator tool page.
 *
 * Kept out of ``favicon-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One image in, the whole icon set out',
      body: 'Drop a logo — PNG, JPEG, WebP or a safe SVG — and the tool renders the icons a site needs: favicons at 16, 32, 48, 180 and 192 pixels, an optional 512-pixel favicon, an Apple touch icon, an Android maskable icon with a safe-zone border, and a multi-image favicon.ico. Everything arrives as one favicons.zip.',
    },
    {
      heading: 'What to do with the download',
      body: 'Unzip it into your site root and paste the link tags the tool prints next to it: favicon.ico, the 192-pixel PNG, the Apple touch icon and a web manifest reference. The generated manifest JSON lists every icon with its pixel size and marks the maskable asset with purpose "maskable".',
    },
    {
      heading: 'Options that change the art',
      body: "Include 512px favicon adds the larger PNG that high-resolution displays and PWA installs prefer. Background fills the letterbox space around non-square art with a hex colour, or leaves it transparent. Maskable icon padding (0–30%) shrinks the artwork inside the 512-pixel Android maskable icon so Android's circular crop cannot cut off the edges.",
    },
    {
      heading: 'Caveats',
      body: 'Every icon fits the image into a square canvas while preserving the aspect ratio, so nothing is stretched — a tall logo simply ends up small inside the square. The maskable padding applies only to the 512-pixel Android asset. SVG input is accepted only after its external references are checked.',
    },
    {
      heading: 'Rendered on your device',
      body: 'Decoding, resizing and ZIP packing all happen in this tab; your logo is never uploaded. That makes it fine for an unreleased brand mark, and it works with no connection once the page has loaded.',
    },
  ],
  faq: [
    {
      q: 'Which files end up in the ZIP?',
      a: 'favicon-16.png, favicon-32.png, favicon-48.png, favicon-180.png, favicon-192.png, apple-touch-icon.png (the same pixels as the 180 favicon), icon-maskable-512.png and a multi-size favicon.ico, plus favicon-512.png when the 512-pixel option is on.',
    },
    {
      q: 'Why is there a separate maskable icon?',
      a: 'Android crops maskable icons into a circle or squircle, so artwork that fills the whole square can lose its edges. The maskable asset shrinks the logo inside the safe zone using the Maskable icon padding setting, and the ordinary favicons are left untouched.',
    },
    {
      q: 'My logo is not square — will it be stretched?',
      a: 'No. Each icon fits the image into a square canvas at the largest size that preserves its aspect ratio, so a wide or tall logo simply has transparent (or background-filled) space around it.',
    },
  ],
} as const;
