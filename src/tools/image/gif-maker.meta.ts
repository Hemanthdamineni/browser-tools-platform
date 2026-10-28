import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gif-maker',
  name: 'GIF Maker',
  category: 'image',
  summary: 'Create animated GIFs from multiple images with frame delay, loop count, and palette options.',
  description:
    'Combine multiple images into an animated GIF. Set frame delay, loop count (0 = infinite), resize frames, and choose palette quality. All processing happens in your browser — no uploads.',
  keywords: [
    'gif maker',
    'animated gif',
    'create gif',
    'gif encoder',
    'gif from images',
    'animation',
    'frame delay',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'delay',
      label: 'Frame delay (ms)',
      type: 'number',
      default: 100,
      min: 10,
      step: 10,
      help: 'Display time for each frame in milliseconds. Lower = faster animation.',
    },
    {
      key: 'loop',
      label: 'Loop count',
      type: 'number',
      default: 0,
      min: 0,
      help: 'Number of times to loop the animation. 0 = infinite loop.',
    },
    {
      key: 'width',
      label: 'Output width (px)',
      type: 'number',
      default: 0,
      min: 0,
      help: 'Resize frames to this width. 0 = use first frame width. Aspect ratio is preserved.',
    },
    {
      key: 'height',
      label: 'Output height (px)',
      type: 'number',
      default: 0,
      min: 0,
      help: 'Resize frames to this height. 0 = use first frame height. Aspect ratio is preserved.',
    },
    {
      key: 'colors',
      label: 'Max colors',
      type: 'select',
      default: '256',
      choices: [
        { value: '16', label: '16 (smallest file)' },
        { value: '32', label: '32' },
        { value: '64', label: '64' },
        { value: '128', label: '128' },
        { value: '256', label: '256 (best quality)' },
      ],
      help: 'Maximum colors in the palette. Fewer colors = smaller file, more banding.',
    },
    {
      key: 'dither',
      label: 'Dithering',
      type: 'boolean',
      default: true,
      help: 'Apply Floyd–Steinberg dithering to reduce banding. Increases file size slightly.',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'gif',
      choices: [
        { value: 'gif', label: 'GIF' },
      ],
    },
  ],
  examples: [
    { title: 'Simple animation', options: { delay: 200, loop: 0 } },
    { title: 'Fast loop (50ms)', options: { delay: 50, loop: 0, colors: 128 } },
    { title: 'High quality, no dither', options: { delay: 100, loop: 1, colors: 256, dither: false } },
    { title: 'Small file size', options: { delay: 100, loop: 0, colors: 64, width: 400 } },
  ],
  faq: [
    {
      q: 'Are my images uploaded?',
      a: 'No. All processing happens locally in your browser. Images never leave your device.',
    },
    {
      q: 'What image formats are supported as input?',
      a: 'PNG, JPEG, WebP, and any other browser-decodable image format.',
    },
    {
      q: 'Why is my GIF so large?',
      a: 'GIF uses a 256-color palette with LZW compression. Reduce dimensions, lower frame rate (increase delay), reduce colors, or use fewer frames to shrink the file.',
    },
    {
      q: 'Can I control the frame order?',
      a: 'Frames are used in the order you select/upload them. Reorder before running the tool.',
    },
    {
      q: 'What is the maximum number of frames?',
      a: '300 frames, to prevent browser memory issues.',
    },
  ],
  related: ['image-convert', 'image-resize', 'image-collage'],
  status: 'stable',
  updated: '2026-10-27',
  credits: [
    {
      name: 'gifenc',
      url: 'https://github.com/mattdesl/gifenc',
      license: 'MIT',
    },
  ],
};