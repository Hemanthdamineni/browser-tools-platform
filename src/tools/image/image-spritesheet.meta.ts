import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-spritesheet',
  name: 'Sprite Sheet Builder',
  category: 'image',
  summary: 'Combine multiple images into one sprite sheet with a position map.',
  description:
    'Arrange images into a grid, row, column, or packed layout and export a sprite sheet PNG/WebP plus JSON and CSS coordinates. All processing happens in your browser.',
  keywords: ['sprite sheet', 'css sprites', 'image sprite generator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      default: 'grid',
      choices: [
        { value: 'grid', label: 'Grid' },
        { value: 'horizontal', label: 'Horizontal row' },
        { value: 'vertical', label: 'Vertical column' },
        { value: 'packed', label: 'Packed' },
      ],
      help: 'Packed tiles sprites tightly by area; grid keeps a uniform cell size.',
    },
    {
      key: 'columns',
      label: 'Grid columns (0 = auto)',
      type: 'number',
      default: 0,
      min: 0,
      max: 64,
      showWhen: { key: 'layout', value: 'grid' },
    },
    { key: 'padding', label: 'Padding (px)', type: 'number', default: 2, min: 0, max: 64 },
    {
      key: 'format',
      label: 'Sheet format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
  ],
  examples: [
    { title: 'Grid sprite sheet' },
    { title: 'A packed sheet with a margin', options: { layout: 'packed', padding: 4 } },
    {
      title: 'A horizontal row for an animation strip',
      options: { layout: 'horizontal', padding: 2 },
    },
  ],
  article: [
    {
      heading: 'Combining images into one canvas',
      body: 'Drop several images and the tool arranges them on a single sprite sheet and returns the PNG or WebP plus the coordinates you need to use it. Because this is a browser canvas operation, the input images are decoded locally and the sheet is drawn here — nothing is uploaded to a sprite service.',
    },
    {
      heading: 'Four layouts for four kinds of sheets',
      body: 'Grid keeps a uniform cell size with an optional column count, which suits icon sets and UI atlases. Horizontal rows the tiles into a single strip, which is what an animation sprite or a scroll-hint expects. Vertical is the column counterpart. Packed orders the tiles by height and shelves them as tightly as the total area allows, producing the smallest square sheet for a mixed set of sizes.',
    },
    {
      heading: 'The position map and naming',
      body: 'The output pairs the sheet with a JSON map that names each tile, and CSS background-position coordinates, so you can paste the offsets straight into a background-image rule. Every file becomes a CSS-safe sprite name — the extension is dropped and characters that are invalid in a class are sanitised — and a name collision appends a number, so two icon files can never share a tile name.',
    },
    {
      heading: 'Padding and the shared canvas budget',
      body: 'The padding option puts a gap between every tile so that a sheet used for hover effects does not bleed into its neighbour. Because the browser caps how large a single canvas can be, the layout checks the requested sheet against that budget and refuses a sheet that would exceed it — the answer is to split the sprites across two runs rather than silently produce a clipped image.',
    },
    {
      heading: 'Everything runs on-device',
      body: 'Images are decoded, arranged and re-encoded entirely in this tab, so the PNG or WebP sheet is a fresh encode of the tiles rather than a raw copy of the originals. Nothing is uploaded, and the tool keeps working offline once loaded.',
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
  related: ['favicon-generator', 'image-resize'],
  status: 'stable',
  updated: '2026-10-17',
};
