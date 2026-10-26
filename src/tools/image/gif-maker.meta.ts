import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gif-maker',
  name: 'GIF Maker',
  category: 'image',
  summary:
    'Build an animated GIF from image frames: order, trim, set delays, pick size, loop and preview.',
  description:
    'Assemble an animated GIF from a set of still images entirely on your device. Drag the frames into the order you want, drop the ones you do not need, give each frame its own delay, choose a loop count, a target width and a size limit, then preview the finished animation before you save it. Nothing is uploaded.',
  keywords: [
    'gif',
    'gif maker',
    'animated',
    'animation',
    'frames',
    'image sequence',
    'stop motion',
    'loop',
    'delay',
    'frame rate',
    'sprite',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  // The reorderable, per-frame timeline cannot be expressed by the generic
  // option form, so the tool opts into the dedicated GIF maker panel. The
  // options below are read by `run()` through `resolveOptions` and keep the
  // tool usable without the UI.
  panel: 'gif-maker',
  options: [
    {
      key: 'width',
      label: 'Output width (pixels)',
      type: 'number',
      default: 480,
      min: 16,
      max: 2000,
      step: 10,
      help: 'Width of the GIF. The height follows the first frame’s aspect ratio.',
    },
    {
      key: 'sizeLimit',
      label: 'Size limit (MB)',
      type: 'number',
      default: 4,
      min: 1,
      max: 16,
      step: 1,
      help: 'The GIF is downscaled automatically until it fits under this limit.',
    },
    {
      key: 'loop',
      label: 'Loop count (0 = forever)',
      type: 'number',
      default: 0,
      min: 0,
      max: 1000,
      step: 1,
      help: '0 plays the animation over and over; any other number plays it that many times.',
    },
    {
      key: 'palette',
      label: 'Palette quality',
      type: 'select',
      default: 'balanced',
      choices: [
        { value: 'small', label: 'Small file — 32 colours, one shared palette' },
        { value: 'balanced', label: 'Balanced — 128 colours, a palette per frame' },
        { value: 'high', label: 'Best quality — 256 colours, dithered' },
      ],
      help: 'How many colours each frame may use, and whether they share a palette.',
    },
    {
      key: 'delayCs',
      label: 'Default frame delay (centiseconds)',
      type: 'number',
      default: 10,
      min: 1,
      max: 1000,
      step: 1,
      help: 'Uniform delay in hundredths of a second. Overridden per frame by the panel.',
    },
    {
      key: 'frameDelays',
      label: 'Per-frame delays (JSON, advanced)',
      type: 'textarea',
      default: '[]',
      help: 'One centisecond delay per frame, in order — e.g. [10, 5, 20]. Empty uses the default delay.',
    },
  ],
  examples: [
    { title: 'Assemble frames into an animation' },
    {
      title: 'Small, fast-loading clip',
      options: { width: 320, sizeLimit: 2, palette: 'small', loop: 0 },
    },
    {
      title: 'High-quality seamless loop',
      options: { width: 640, sizeLimit: 8, palette: 'high', loop: 0 },
    },
    {
      title: 'Play exactly five times',
      options: { loop: 5, palette: 'balanced' },
    },
  ],
  credits: [{ name: 'gifenc', url: 'https://github.com/mattdesl/gifenc', license: 'MIT' }],
  related: ['image-spritesheet', 'image-resize', 'video-to-gif', 'image-palette'],
  status: 'stable',
};
