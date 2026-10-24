import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-diff',
  name: 'Image Difference',
  category: 'image',
  summary: 'Compare two images and visualize their pixel differences.',
  description:
    'Compare two images locally, export a heatmap/highlight/side-by-side PNG, and inspect difference statistics. Nothing is uploaded.',
  keywords: ['image diff', 'compare images', 'visual difference', 'pixel comparison'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'threshold',
      label: 'Difference threshold (%)',
      type: 'range',
      default: 10,
      min: 0,
      max: 100,
      help: 'A pixel counts as different when its largest RGBA channel delta exceeds this percentage.',
    },
    {
      key: 'output',
      label: 'Visualization',
      type: 'select',
      default: 'heatmap',
      choices: [
        { value: 'heatmap', label: 'Heatmap' },
        { value: 'highlight', label: 'Highlight' },
        { value: 'side-by-side', label: 'Side by side' },
      ],
    },
  ],
  examples: [
    { title: 'Compare two images' },
    { title: 'Spot tiny differences with a low threshold', options: { threshold: 0 } },
    { title: 'View both images side by side', options: { output: 'side-by-side' } },
  ],
  faq: [
    {
      q: 'Do both images need the same dimensions?',
      a: 'No. The second image is scaled to the first image dimensions before comparison, and a note is added when the sizes differ. Scaling can shift edges, so a crop-to-crop comparison is more accurate than one across differently sized renders.',
    },
    {
      q: 'What counts as a differing pixel?',
      a: 'A pixel is different when its largest channel delta across all four RGBA channels exceeds the threshold percentage. Transparency is compared too, so a change from opaque to transparent is a difference.',
    },
    {
      q: 'Which file is produced?',
      a: 'The tool returns a single PNG called image-diff.png. Heatmap and highlight show the first image with differences overlaid; side-by-side places the two inputs next to each other.',
    },
  ],
  article: [
    {
      heading: 'Comparing two images pixel by pixel',
      body: 'Give the tool exactly two image files. Each is decoded in the browser, drawn into equally sized canvases and compared pixel by pixel across all four RGBA channels. You get a table of total pixels, differing pixels, the percentage that changed and the mean and maximum channel delta, plus a PNG named image-diff.png that shows where the change sits.',
    },
    {
      heading: 'Checking a rebuild or a re-render',
      body: 'Reach for it when a page or asset was rebuilt and you want evidence that only the intended area moved, or when an image pipeline is suspected of shifting colours and edges. Comparing two exports of one chart, or a design mock against its build, turns a vague it looks off into a number and a picture.',
    },
    {
      heading: 'Threshold and visualisation choices',
      body: 'The threshold slider sets how large a channel delta counts as a difference, from zero for any change at all up to a coarse comparison. The visualisation selector picks heatmap, which tints changes red with transparency tracking the delta, highlight, which marks changed pixels in magenta over a dimmed original, or side by side.',
    },
    {
      heading: 'Limits worth knowing',
      body: 'If the two inputs differ in size the second is scaled to the first before comparing, and scaling can shift edges, so a same-size pair is more trustworthy. A change in transparency counts as a difference. The score is per pixel only, with no structural or perceptual weighting, and side-by-side doubles the output width.',
    },
    {
      heading: 'Both images stay on your device',
      body: 'Decoding, comparison and PNG encoding all happen inside the page. Nothing is uploaded and the tool works offline, so screenshots of unreleased work or private documents can be compared without them leaving the machine.',
    },
  ],
  status: 'stable',
  updated: '2026-10-17',
};
