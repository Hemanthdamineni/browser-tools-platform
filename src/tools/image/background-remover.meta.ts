import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'background-remover',
  name: 'Remove Background',
  category: 'image',
  summary: 'Cut a subject out of a photo with an on-device AI matting model (MODNet).',
  description:
    'Isolate the subject of a portrait or photo with MODNet, an on-device portrait-matting model. The model downloads from the Hugging Face Hub on first use and is cached in your browser, so repeat runs are instant. Your images never leave your device.',
  keywords: [
    'remove background',
    'background remover',
    'cutout',
    'transparent png',
    'portrait matting',
    'subject extraction',
    'ai background removal',
  ],
  privacy: { processing: 'on-device', network: ['huggingface.co'], offline: false },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'background',
      label: 'Background result',
      type: 'select',
      default: 'transparent',
      choices: [
        { value: 'transparent', label: 'Transparent (PNG alpha)' },
        { value: 'solid', label: 'Solid colour' },
      ],
      help: 'Replace the removed background with transparency, or fill it with a flat colour.',
    },
    {
      key: 'backgroundColour',
      label: 'Background colour',
      type: 'text',
      default: '#ffffff',
      showWhen: { key: 'background', value: 'solid' },
      help: 'A hex colour such as #ffffff. Uses the current value when filled.',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
      help: 'PNG keeps a clean alpha channel. WebP is smaller but harder to edit elsewhere.',
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      showWhen: { key: 'format', value: 'webp' },
    },
    {
      key: 'threshold',
      label: 'Matte threshold (%)',
      type: 'range',
      default: 0,
      min: 0,
      max: 100,
      help: '0 keeps MODNet’s soft, feathered edges. Higher values snap soft edge pixels to fully transparent or fully opaque for a crisper cut-out.',
    },
  ],
  examples: [{ title: 'Cut out a portrait' }],
  credits: [
    {
      name: 'MODNet (Xenova/modnet)',
      url: 'https://huggingface.co/Xenova/modnet',
      license: 'Apache-2.0',
    },
  ],
  faq: [
    {
      q: 'How does the model get downloaded?',
      a: 'The MODNet weights are pulled from the Hugging Face Hub the first time you run the tool and kept in the browser’s Cache Storage, so later runs work offline. Your images are never uploaded — everything happens in your browser.',
    },
    {
      q: 'Is my photo sent anywhere?',
      a: 'No. The only network request is the model download from huggingface.co on first use; the photo itself is processed entirely on your device.',
    },
    {
      q: 'Which images work best?',
      a: 'MODNet is a portrait matting model: it is best at isolating a single person. Group photos, pets or objects with no clear person may keep some background. Use the matte threshold to tighten feathered edges.',
    },
    {
      q: 'Why is my result pixelated or slightly off?',
      a: 'The model runs at 512 px then scales back up, so small, heavily-compressed or very high-resolution photos may show soft edges. Save as PNG to keep the alpha channel lossless.',
    },
  ],
  related: ['image-compress', 'image-convert', 'image-resize'],
  status: 'beta',
  updated: '2026-10-24',
};
