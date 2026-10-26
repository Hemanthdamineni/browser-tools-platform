/**
 * Editorial content for the image-collage tool page.
 *
 * Kept out of ``image-collage.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Arranging photos into a grid',
      body: 'Add two or more images and the collage maker tiles them into a uniform grid you can download as a single PNG or JPEG. Each cell is square and sized to the largest source edge, so the busiest photo sets the resolution and nothing is ever upscaled.',
    },
    {
      heading: 'Choosing a layout',
      body: 'Columns defaults to Auto, which picks a roughly square grid — four photos become a 2×2. Pin it to 1, 2, 3 or 4 to force a shape; the number of rows follows from how many images you add. Spacing is the gap between cells, and the background fills it with a hex colour or stays transparent.',
    },
    {
      heading: 'Framing and reordering',
      body: 'Rounded corners and an optional cell border with its own colour and width dress the tiles up. To change the arrangement, drag a thumbnail into a new slot: the order you see on the preview is exactly the order saved, and reordering moves placements rather than re-encoding pixels.',
    },
    {
      heading: 'PNG, JPEG and transparency',
      body: 'PNG keeps any transparency around and between the photos; JPEG cannot, so a transparent background is flattened onto white. Switching to JPEG also unlocks a quality slider, which trades file size against detail.',
    },
    {
      heading: 'Rendered on your device',
      body: 'Decoding, layout and export all happen in the page, so your photos never leave the browser and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'Can I change which photo sits where?',
      a: 'Yes. Drag any thumbnail to a new slot on the preview grid and export — the order you see is the order that is saved. Reordering moves placements, never the pixels themselves, so nothing is re-encoded or degraded.',
    },
    {
      q: 'Why does the export look sharper than the preview?',
      a: 'The preview is downscaled to keep the page responsive. The export renders each photo at full resolution, so the saved file keeps every pixel of your originals.',
    },
    {
      q: 'What happens when I pick a background with JPEG?',
      a: 'JPEG has no transparency, so a transparent background is flattened onto white. Choose any hex colour and it fills the gaps between the photos instead.',
    },
  ],
} as const;
