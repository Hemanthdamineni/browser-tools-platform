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
      body: 'This is not AI super-resolution. The tool resamples the pixels you already have with a Lanczos3, bicubic or nearest-neighbour kernel, so it can enlarge a picture and keep it sharp, but it cannot invent texture that was never captured. A neural upscaler trained on thousands of photos can hallucinate plausible detail; this one cannot, and it makes no network request to any model. That honesty matters: the browser-ready super-resolution models available today (APISR, Swin2SR) are GPL-3.0, and this project ships only permissively licensed code, so they are deliberately left out rather than quietly downloaded.',
    },
    {
      heading: 'Choosing an interpolation method',
      body: 'Lanczos3 uses a windowed sinc function with negative lobes, which preserves fine detail and edges but can produce a faint halo around high-contrast lines. Bicubic is the gentler choice most image editors default to: softer, with far less ringing, and a good match for noisy photos. Nearest-neighbour simply repeats each source pixel, which is exactly right for pixel art, screenshots and icons where any smoothing would destroy the intended hard edges. Switch kernels and the preview updates, so you can compare before committing.',
    },
    {
      heading: 'Why the result is sharpened afterwards',
      body: 'Interpolation is a low-pass operation: every kernel averages neighbouring pixels, so edges lose a little contrast. The optional unsharp mask adds back a scaled copy of the difference between the image and a blurred version of it, restoring that micro-contrast. Amount 0 disables it; around 40% is a good starting point for photos. With detail-preserving sharpening on, the blur radius grows with the scale factor, so a 4× enlargement is sharpened across the same physical distance in the source image rather than only across one output pixel.',
    },
    {
      heading: 'Preview, limits and export',
      body: 'The preview is computed on the main thread at a reduced resolution so the sliders stay responsive, and the status line says when it is scaled down. The export itself runs in a Web Worker at the full target resolution and is capped by browser canvas limits — 100 million pixels and 16,384 pixels per side — so an enormous target is reported as an error instead of freezing the tab. PNG keeps transparency, so a cut-out stays a cut-out; JPEG has no alpha channel, so JPEG output is composited onto white first.',
    },
  ],
  related: ['image-resize', 'image-compress', 'image-convert', 'image-crop'],
  status: 'stable',
  updated: '2026-10-24',
};
