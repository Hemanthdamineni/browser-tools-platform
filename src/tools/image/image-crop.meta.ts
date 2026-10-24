import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-crop',
  name: 'Crop Image',
  category: 'image',
  summary: 'Crop an image to an aspect ratio or explicit pixel rectangle.',
  description:
    'Select an aspect ratio and anchor or define an exact crop rectangle. Cropping happens locally in the browser.',
  keywords: ['crop image', 'image cropper', 'aspect ratio', 'trim photo'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'mode',
      label: 'Crop mode',
      type: 'select',
      default: 'aspect',
      choices: [
        { value: 'aspect', label: 'Aspect ratio' },
        { value: 'pixels', label: 'Pixels' },
      ],
    },
    {
      key: 'aspect',
      label: 'Aspect ratio',
      type: 'text',
      default: '1:1',
      showWhen: { key: 'mode', value: 'aspect' },
      help: 'Width:height, for example 16:9.',
    },
    {
      key: 'anchor',
      label: 'Anchor',
      type: 'select',
      default: 'center',
      choices: [
        'center',
        'top',
        'bottom',
        'left',
        'right',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ].map((value) => ({ value, label: value })),
      showWhen: { key: 'mode', value: 'aspect' },
    },
    {
      key: 'x',
      label: 'X',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'pixels' },
    },
    {
      key: 'y',
      label: 'Y',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'pixels' },
    },
    {
      key: 'cropWidth',
      label: 'Crop width',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'pixels' },
    },
    {
      key: 'cropHeight',
      label: 'Crop height',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'pixels' },
    },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'original',
      choices: ['original', 'png', 'jpeg', 'webp'].map((value) => ({ value, label: value })),
    },
  ],
  article: [
    {
      heading: 'What it takes and returns',
      body: 'Upload one or more images and the tool returns cropped copies named <original>-crop.<ext>. In Aspect ratio mode it cuts the largest rectangle of that ratio that fits and positions it with the anchor; in Pixels mode it uses your x, y, width and height. Format keeps the source type, or you can force PNG, JPEG or WebP.',
    },
    {
      heading: 'A concrete use',
      body: 'Turning a batch of uneven screenshots into square avatars: choose 1:1, anchor center, pick JPEG, and every file comes back cropped and re-encoded in one pass.',
    },
    {
      heading: 'What each option changes',
      body: 'anchor only shifts the rectangle within Aspect ratio mode — a left or right anchor pins x, a top or bottom anchor pins y, and center splits the slack evenly. In Pixels mode the rectangle is clamped to the image, and a box that falls entirely outside or has zero size raises an error instead of a blank file. Choosing JPEG flattens transparency onto white because the format has no alpha channel.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'Aspect ratios must be two positive numbers written like 16:9; anything else, such as 16 or 0:1, is rejected. Enormous images are refused up front: each side is limited to about 16,384 px and the total to 100 megapixels so a decode cannot crash the tab. EXIF orientation is honoured, so the crop applies to the upright image.',
    },
    {
      heading: 'Privacy',
      body: 'Your files are decoded and re-encoded entirely on this device; no image is uploaded.',
    },
  ],
  examples: [
    { title: 'Square center crop' },
    {
      title: 'Exact 800x600 rectangle from the top-left',
      options: { mode: 'pixels', x: 0, y: 0, cropWidth: 800, cropHeight: 600 },
    },
    {
      title: '16:9 banner anchored to the top, saved as WebP',
      options: { mode: 'aspect', aspect: '16:9', anchor: 'top', format: 'webp' },
    },
  ],
  faq: [
    {
      q: 'Does cropping re-encode the image?',
      a: 'Yes. The result is drawn onto a new canvas and encoded again, so it is a fresh copy rather than a metadata edit. PNG and WebP keep transparency; JPEG cannot, so anything transparent is flattened onto white before encoding.',
    },
    {
      q: 'Can I crop several images at once?',
      a: 'Yes. Every selected file is cropped with the same settings and returned in input order, each named after the source with a -crop suffix.',
    },
    {
      q: 'What does the Pixels mode do when my rectangle goes past the edge?',
      a: 'The width and height are trimmed so the rectangle stays inside the image. If the start point is already outside the image, or the resulting width or height works out to zero, the tool reports that the rectangle is outside the image or has zero size instead of producing an empty file.',
    },
  ],
  related: ['image-resize', 'image-rotate'],
  status: 'stable',
  updated: '2026-10-16',
};
