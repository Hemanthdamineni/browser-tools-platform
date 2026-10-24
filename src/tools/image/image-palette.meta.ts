import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-palette',
  name: 'Extract Colour Palette',
  category: 'image',
  summary: 'Extract the dominant colour palette from an image locally.',
  description:
    'Sample an image and produce a palette of representative colours using median-cut, k-means or most-frequent quantization. Pixels are analysed in your browser only.',
  keywords: ['image palette', 'extract colors', 'dominant colors', 'color palette image'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    { key: 'colors', label: 'Number of colours', type: 'number', default: 6, min: 2, max: 16 },
    {
      key: 'algorithm',
      label: 'Algorithm',
      help: 'Median-cut balances coverage; k-means groups similar colours; most-frequent keeps the most common buckets.',
      type: 'select',
      default: 'median-cut',
      choices: ['median-cut', 'k-means', 'most-frequent'].map((value) => ({ value, label: value })),
    },
  ],
  article: [
    {
      heading: 'What comes out of the sampler',
      body: 'The tool decodes an image in your browser, then quantizes up to ten thousand sampled pixels into a palette of hex colours. A single image returns a colour-swatch render of its palette plus the dominant colour and an appearance guess of mostly light or mostly dark; several images become one table listing each file, its dominant colour and the full palette.',
    },
    {
      heading: 'A real design use',
      body: 'Point it at a brand asset or a screenshot and read the dominant colour back to build a theme, pick an accent, or check how a design reads at a glance. Because it works on a local canvas, it is also a safe way to sample artwork you are not allowed to upload.',
    },
    {
      heading: 'Choosing an algorithm',
      body: 'Median-cut splits the colour box along its widest range to balance coverage. K-means groups similar colours into clusters and, thanks to a fixed seed, returns a stable palette across runs. Most-frequent simply keeps the most common colour buckets. All three honour the number of colours option, clamped between 2 and 16.',
    },
    {
      heading: 'What is ignored and how large it can go',
      body: 'Pixels with an alpha below 32 are discarded so transparency does not skew the palette, and a fully transparent image reports no opaque pixels. The sample is capped at ten thousand pixels, so very large files are read at a bounded size rather than decoding unbounded bitmaps.',
    },
    {
      heading: 'All analysis stays on the page',
      body: 'Pixels are read from a canvas in this tab and never uploaded. Everything runs offline once loaded, so a sensitive image can be sampled without any of its data leaving the device.',
    },
  ],
  examples: [
    { title: 'Extract 6 colours' },
    {
      title: 'Eight colours with k-means',
      options: { colors: 8, algorithm: 'k-means' },
    },
    {
      title: 'Dominant colour from a small palette',
      options: { colors: 3, algorithm: 'most-frequent' },
    },
  ],
  faq: [
    {
      q: 'Are fully transparent pixels used?',
      a: 'No. Pixels with an alpha below 32 are ignored so they do not skew the palette.',
    },
    {
      q: 'Is my image uploaded?',
      a: 'No. Sampling happens on a canvas in your browser.',
    },
    {
      q: 'Can I compare several images?',
      a: 'Yes. Select multiple files and each image is listed with its dominant colour and full palette.',
    },
  ],
  related: ['color-palette', 'color-name', 'image-metadata'],
  status: 'stable',
  updated: '2026-10-17',
};
