import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-blur-redact',
  name: 'Blur & Redact Image',
  category: 'image',
  summary:
    'Blur, pixelate or black out parts of an image and export a clean copy with no metadata.',
  description:
    'Draw rectangles over a photo and blur, pixelate or black them out, then export a re-encoded copy with no EXIF, GPS or XMP left in it. The redaction is baked into the exported pixels — it is a real change to the image data, never a reversible overlay that a viewer could peel off.',
  keywords: [
    'blur image',
    'redact photo',
    'pixelate face',
    'censor image',
    'hide license plate',
    'mosaic image',
    'remove exif',
    'redact screenshot',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/png,image/jpeg,image/webp',
  multiple: false,
  panel: 'image-blur-redact',
  options: [
    {
      key: 'effect',
      label: 'Default effect',
      type: 'select',
      default: 'blur',
      choices: [
        { value: 'blur', label: 'Blur' },
        { value: 'pixelate', label: 'Pixelate (mosaic)' },
        { value: 'black', label: 'Black out' },
      ],
      help: 'Used for every region that does not set its own effect in the region list.',
    },
    {
      key: 'radius',
      label: 'Blur radius (pixels)',
      type: 'range',
      default: 8,
      min: 0,
      max: 64,
      step: 1,
      showWhen: { key: 'effect', value: 'blur' },
      help: 'A larger radius hides more. 0 leaves the region untouched — raise it if the rectangle must stay unreadable.',
    },
    {
      key: 'cellSize',
      label: 'Pixelate cell size (pixels)',
      type: 'range',
      default: 12,
      min: 2,
      max: 64,
      step: 1,
      showWhen: { key: 'effect', value: 'pixelate' },
      help: 'Each square averages the pixels it covers. Bigger squares destroy more detail.',
    },
    {
      key: 'opacity',
      label: 'Effect opacity (%)',
      type: 'range',
      default: 100,
      min: 0,
      max: 100,
      step: 5,
      help: '100% replaces the pixels outright. Anything less blends the effect over the original — 0% redacts nothing.',
    },
    {
      key: 'format',
      label: 'Export format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG (lossless)' },
        { value: 'jpeg', label: 'JPEG (smaller)' },
        { value: 'webp', label: 'WebP' },
      ],
      help: 'The image is re-encoded from pixels, so no metadata segment survives in any format.',
    },
    {
      key: 'quality',
      label: 'Quality (%) for JPEG and WebP',
      type: 'range',
      default: 92,
      min: 10,
      max: 100,
      step: 1,
      help: 'Ignored for PNG, which is always lossless.',
    },
    {
      key: 'regions',
      label: 'Redaction regions (JSON)',
      type: 'textarea',
      default: '[]',
      help: 'Filled in by the canvas above: an array of { x, y, w, h } rectangles in percent of the image, each with an optional effect. You can also edit it by hand — the canvas follows the JSON.',
    },
  ],
  examples: [
    { title: 'Blur a number plate or a face' },
    {
      title: 'Mosaic a whole region',
      options: { effect: 'pixelate', cellSize: 20 },
    },
    {
      title: 'Black out at full opacity and save as JPEG',
      options: { effect: 'black', opacity: 100, format: 'jpeg', quality: 90 },
    },
  ],
  article: [
    {
      heading: 'Draw, choose an effect, export',
      body: 'Open a PNG, JPEG or WebP, draw one or more rectangles over the areas you want gone, then export. Each region can take its own effect — blur, pixelate or a solid black box — and the tool-wide setting covers any region that does not override it. The result is a re-encoded copy with the effect applied to the real pixels.',
    },
    {
      heading: 'The regions are percentages, not pixels',
      body: 'The rectangles live in the “Redaction regions” field as an array of { x, y, w, h } values in percent of the image, each with an optional effect. That means changing the blur radius or export format reuses the same regions, and you can edit the JSON by hand if you are scripting the workflow.',
    },
    {
      heading: 'Why a real redaction beats an overlay',
      body: 'The effect is baked into the exported pixels when the file is re-encoded — nothing is kept as a layer, mask or overlay, so a viewer cannot peel it back. Strong pixelation or a black box hides the most; a light blur can still hint at what was underneath, so keep the radius high and the rectangle generous.',
    },
    {
      heading: 'Metadata goes with it',
      body: 'The export is redrawn through a canvas and encoded from scratch, so EXIF, GPS, XMP, IPTC, the ICC profile and comments are all gone, and there is no option to keep them. The stored EXIF orientation is applied while decoding, so a phone photo comes out the right way up with the rotation baked in.',
    },
    {
      heading: 'The pixels stay on your device',
      body: 'Drawing, the box blur, the pixelation averaging and the final encode all happen in this tab. At 0% effect opacity nothing is redacted at all, so check the exported file before you send it.',
    },
  ],
  faq: [
    {
      q: 'Can anyone undo the blur?',
      a: 'No. The effect is baked into the exported pixels when the file is re-encoded — nothing is stored as a layer, mask or overlay, so a viewer cannot reveal the original. Strong pixelation or a black box hides the most; a light blur can still hint at what was underneath, so keep the radius high and the rectangle generous.',
    },
    {
      q: 'Which metadata is removed?',
      a: 'All of it. The export is redrawn through a canvas and encoded from scratch, so EXIF, GPS, XMP, IPTC, the ICC profile and comments are gone. There is no option to keep them — a redacted copy should not carry a location with it.',
    },
    {
      q: 'Do the regions survive a re-run?',
      a: 'Yes. The rectangles you draw live in the “Redaction regions” field as percentages, so changing the effect, the radius or the export format re-uses the same regions without redrawing them.',
    },
    {
      q: 'Which files can I use?',
      a: 'PNG, JPEG and WebP. Other formats should be converted first with the Image Converter.',
    },
    {
      q: 'Why does my phone photo come out the right way up?',
      a: 'The stored EXIF orientation is applied while decoding, so the rotation is baked into the pixels, and the tag itself is dropped with the rest of the metadata.',
    },
    {
      q: 'Is anything uploaded?',
      a: 'No. Drawing, blurring and encoding all happen in your browser; the image never leaves your device.',
    },
  ],
  related: ['image-crop', 'image-strip-metadata', 'image-metadata', 'image-convert'],
  status: 'beta',
  updated: '2026-10-24',
};
