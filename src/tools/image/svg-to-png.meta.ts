import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-to-png',
  name: 'SVG to PNG',
  category: 'image',
  summary: 'Rasterize an SVG image to a downloadable PNG.',
  description:
    'Convert SVG artwork to PNG at a chosen scale or exact size, entirely in your browser. The SVG never leaves your device.',
  keywords: ['svg to png', 'rasterize svg', 'convert vector image', 'svg converter'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/svg+xml,.svg',
  article: [
    {
      heading: 'One SVG in, one PNG out',
      body: 'You supply a single .svg file and get a PNG named after that source. The intrinsic size is read from the width and height attributes, falling back to the viewBox, and the stats line reports the pixel width and height actually rasterised.',
    },
    {
      heading: 'When a raster copy of vector art is what you need',
      body: 'Useful when a service only accepts bitmaps but the original is vector. The pipeline runs from an SVG blob through createImageBitmap onto an OffscreenCanvas, so you get a faithful rasterisation without opening a graphics editor.',
    },
    {
      heading: 'Scale versus exact width and height',
      body: 'Scale multiplies the intrinsic size, so 2 on a 100×50 SVG yields 200×100. Setting a width or height override treats that figure as absolute pixels and derives the other edge from the aspect ratio, ignoring Scale. Background takes transparent or a three- or six-digit hex colour, painted underneath the artwork.',
    },
    {
      heading: 'Sizing limits and blocked markup',
      body: 'An SVG over 8 MB is refused before parsing, and any canvas above 16,384 px per side or 100,000,000 pixels is rejected to protect the tab. Scripts, event handlers, foreignObject, external DOCTYPEs, external references and @import rules stop the conversion. Nothing is uploaded; the bytes are read and rasterised on your device.',
    },
  ],
  options: [
    {
      key: 'scale',
      label: 'Scale',
      type: 'number',
      default: 2,
      min: 1,
      max: 8,
      help: 'Ignored when a width or height override is set.',
    },
    {
      key: 'width',
      label: 'Width override (0 = SVG size)',
      type: 'number',
      default: 0,
      min: 0,
      max: 16384,
      help: 'Exact output width in pixels; height follows the aspect ratio.',
    },
    {
      key: 'height',
      label: 'Height override (0 = SVG size)',
      type: 'number',
      default: 0,
      min: 0,
      max: 16384,
      help: 'Exact output height in pixels; width follows the aspect ratio.',
    },
    {
      key: 'background',
      label: 'Background (transparent or hex)',
      type: 'text',
      default: 'transparent',
      help: '“transparent”, or a hex colour such as #ffffff behind the artwork.',
    },
  ],
  examples: [
    { title: 'Rasterize SVG at 2×' },
    { title: 'Export at an exact 1200 px width' },
    { title: 'Rasterize at 4× with a white background' },
  ],
  faq: [
    {
      q: 'Does the PNG keep a transparent background?',
      a: 'Yes — Background defaults to transparent, so the alpha channel is preserved. Setting a hex colour paints that colour across the whole canvas before the artwork is drawn, which is what you want for a solid print-ready image.',
    },
    {
      q: 'Why is my Scale value ignored?',
      a: 'A non-zero Width or Height override switches the tool to absolute sizing, where the other edge follows the aspect ratio, so Scale no longer applies. Set both overrides back to 0 to size by scale again.',
    },
    {
      q: 'Which SVGs are rejected?',
      a: 'Anything over 8 MB, markup containing script, foreignObject or inline on* handlers, and files that reference external resources or stylesheets. Inline the reference as a data: URL or remove it, then try again.',
    },
  ],
  related: ['image-convert', 'image-resize'],
  status: 'stable',
  updated: '2026-10-17',
};
