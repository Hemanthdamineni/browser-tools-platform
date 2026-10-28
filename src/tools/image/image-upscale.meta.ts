import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-upscale',
  name: 'Upscale Image',
  category: 'image',
  summary:
    'Enlarge photos 2× or 4× with sharp Lanczos resampling and edge-preserving sharpening, on-device.',
  description:
    'Enlarge a PNG, JPEG or WebP image 2×, 4× or by a custom percentage using high-quality Lanczos3 resampling, with optional unsharp-mask sharpening. This is algorithmic upscaling — not AI super-resolution — and everything runs locally in your browser.',
  keywords: [
    'upscale image',
    'image enlarger',
    'increase resolution',
    'lanczos',
    'sharpen image',
    'enlarge photo',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/png,image/jpeg,image/webp',
  panel: 'image-upscale',
  options: [
    {
      key: 'scale',
      label: 'Scale factor',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2×' },
        { value: '4', label: '4×' },
        { value: 'custom', label: 'Custom %' },
      ],
    },
    {
      key: 'percent',
      label: 'Scale (%)',
      type: 'number',
      default: 150,
      min: 101,
      step: 1,
      showWhen: { key: 'scale', value: 'custom' },
      help: 'Above 100%: this tool only enlarges, so a smaller value is raised to 101%.',
    },
    {
      key: 'interpolation',
      label: 'Interpolation',
      type: 'select',
      default: 'lanczos3',
      choices: [
        { value: 'lanczos3', label: 'Lanczos3 (sharpest)' },
        { value: 'bicubic', label: 'Bicubic (smoother)' },
        { value: 'nearest', label: 'Nearest (pixelated)' },
      ],
      help: 'Lanczos3 keeps the most detail but can halo; bicubic is gentler; nearest keeps pixel art blocky.',
    },
    {
      key: 'sharpen',
      label: 'Sharpening',
      type: 'range',
      default: 40,
      min: 0,
      step: 5,
      help: 'Unsharp-mask strength after resampling. 0 disables it. Interpolation softens edges; a little sharpening puts the contrast back.',
    },
    {
      key: 'detail',
      label: 'Detail-preserving sharpening',
      type: 'boolean',
      default: true,
      help: 'On: the sharpening radius grows with the scale factor, so edges are recovered at the new resolution. Off: a fixed 1-pixel radius.',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 92,
      min: 10,
      step: 1,
      help: 'Used for JPEG and WebP output. PNG is lossless and ignores it.',
    },
  ],
  examples: [
    { title: '2× with light sharpening', options: { scale: '2', sharpen: 40, detail: true } },
    {
      title: '4× smooth (no sharpening)',
      options: { scale: '4', interpolation: 'bicubic', sharpen: 0 },
    },
    {
      title: 'Pixel art 2× (nearest)',
      options: { scale: '2', interpolation: 'nearest', sharpen: 0 },
    },
  ],
  related: ['image-resize', 'image-compress', 'image-convert', 'image-crop'],
  status: 'stable',
  updated: '2026-10-24',
};
