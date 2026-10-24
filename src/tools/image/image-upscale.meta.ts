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
      max: 800,
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
      max: 200,
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
      max: 100,
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
  faq: [
    {
      q: 'Is this AI super-resolution?',
      a: 'No. This tool uses classical resampling — Lanczos3, bicubic or nearest-neighbour interpolation — plus an optional unsharp mask. There is no neural network and no learned model, so it cannot invent detail that is not in the photo, but it is fully offline, instant and licence-clean.',
    },
    {
      q: 'Why is there no AI super-resolution here?',
      a: 'The open super-resolution models that run in a browser tab (APISR, Swin2SR) are GPL-3.0 licensed. This project only ships permissive-licensed code and models, so they are deliberately excluded rather than quietly downloaded. Algorithmic upscaling carries no such restriction and stays on your device.',
    },
    {
      q: 'How large can the output be?',
      a: 'The output is capped by what the browser can safely hold: 100 million pixels and 16,384 pixels per side. A 4000×3000 photo at 2× becomes 8000×6000 (48 MP), which is fine; at 4× it would be 256 MP and is rejected with a suggestion to use 2× instead.',
    },
    {
      q: 'Does upscaling add real detail?',
      a: 'No. Interpolation can only estimate each missing pixel from its neighbours, so it smooths or sharpens what is already there but never creates texture the photo lacks. That is exactly why true super-resolution models exist — and why they are GPL-licensed and not included here.',
    },
    {
      q: 'Which interpolation should I pick?',
      a: 'Lanczos3 for photos and screenshots that need to stay crisp, bicubic when the source is noisy or you want no ringing at all, and nearest-neighbour for pixel art, icons and textures where every source pixel must stay a hard-edged block.',
    },
  ],
  article: [
    {
      heading: 'Algorithmic upscaling, stated plainly',
      body: 'Upscale Image enlarges a PNG, JPEG or WebP by 2x, 4x or a custom percentage, returning a new file in the format you choose. It resamples with a Lanczos3, bicubic or nearest-neighbour kernel, so it keeps a picture sharp but is not AI super-resolution and cannot invent texture the camera never caught. The browser-ready neural models (APISR, Swin2SR) are GPL-3.0, and this project ships only permissive licences, so they are deliberately excluded.',
    },
    {
      heading: 'When enlarging is the right move',
      body: 'Reach for it when a small logo must fill a slide or an old screenshot needs to print legibly; for noisy photos a gentler kernel beats an aggressive one.',
    },
    {
      heading: 'Interpolation, sharpening and format',
      body: 'Lanczos3 preserves the most detail but can halo around hard edges; bicubic is gentler, with less ringing; nearest keeps pixel art blocky and suits icons and textures. Interpolation softens edges, so the unsharp mask adds contrast back, where 0 disables it and about 40 percent suits photos, while detail-preserving sharpening widens the radius as the scale grows. PNG keeps transparency; JPEG and WebP use the quality slider.',
    },
    {
      heading: 'Caps, preview and where the pixels stay',
      body: 'Output is capped at 100 million pixels and 16,384 per side, so an oversized target errors instead of freezing the tab, and because it only enlarges, a custom value below 101 percent is raised to 101. The preview renders on the main thread at reduced resolution and labels itself as scaled down, while the export runs in a worker at full size; JPEG output is composited onto white first. Everything stays on your device with no network request.',
    },
  ],
  related: ['image-resize', 'image-compress', 'image-convert', 'image-crop'],
  status: 'stable',
  updated: '2026-10-24',
};
