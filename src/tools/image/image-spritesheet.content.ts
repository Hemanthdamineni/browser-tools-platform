/**
 * Editorial content for the image-spritesheet tool page.
 *
 * Kept out of ``image-spritesheet.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Combining images into one canvas',
      body: 'Drop several images and the tool arranges them on a single sprite sheet and returns the PNG or WebP plus the coordinates you need to use it. This is a browser canvas operation — the images are decoded locally and the sheet is drawn here, with nothing uploaded to a sprite service.',
    },
    {
      heading: 'Four layouts for four kinds of sheets',
      body: 'Grid keeps a uniform cell size with an optional column count for icon sets and UI atlases. Horizontal rows the tiles into a single strip, which is what an animation sprite expects; vertical is the column counterpart. Packed orders tiles by height and shelves them tightly, producing the smallest square sheet for a mixed set of sizes.',
    },
    {
      heading: 'The position map and naming',
      body: 'The output pairs the sheet with a JSON map that names each tile and CSS background-position coordinates, so you can paste the offsets straight into a background-image rule. Every file becomes a CSS-safe sprite name, and a collision appends a number, so two icons can never share a tile name.',
    },
    {
      heading: 'Padding and the shared canvas budget',
      body: 'Padding puts a gap between every tile so a hover sprite does not bleed into its neighbour. Because a browser caps how large one canvas can be, the layout checks the requested sheet against that budget and refuses one that would exceed it — split the sprites across two runs rather than get a clipped image.',
    },
    {
      heading: 'Everything runs on-device',
      body: 'Images are decoded, arranged and re-encoded entirely in this tab, so the sheet is a fresh encode of the tiles rather than a raw copy. Nothing is uploaded, and the tool works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'Which formats can I combine?',
      a: 'Any image your browser can decode, so PNG, JPEG, GIF, WebP and AVIF all work. Tiles are re-encoded into the chosen sheet format, so they need not match each other.',
    },
    {
      q: 'What is a packed layout?',
      a: 'Tiles are ordered tallest-first and shelved to keep the sheet roughly square, which wastes far less space than a uniform grid when the images differ in size. Grid keeps the cells identical for a predictable layout.',
    },
    {
      q: 'Why did my sheet get refused as too large?',
      a: 'A browser canvas has a maximum area and dimension. The tool checks the computed sheet against that budget and tells you to split the set instead of failing silently or clipping the output.',
    },
  ],
} as const;
