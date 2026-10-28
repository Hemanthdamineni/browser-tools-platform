import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'background-remover',
  name: 'Background Remover',
  category: 'image',
  summary:
    'Remove backgrounds from images using on-device AI — portraits, products, logos and more.',
  description:
    'Upload a photo and the tool runs a lightweight segmentation model (MODNet) entirely in your browser to separate the foreground from the background. Export a transparent PNG or replace the background with a solid colour.',
  keywords: [
    'remove background',
    'background removal',
    'transparent background',
    'cut out image',
    'modnet',
    'portrait matting',
    'product photo background',
    'background eraser',
    'ai background remover',
  ],
  privacy: { processing: 'on-device', network: ['https://huggingface.co'], offline: false },
  input: 'file',
  multiple: false,
  worker: true,
  options: [
    {
      key: 'output',
      label: 'Output',
      type: 'select',
      default: 'transparent',
      choices: [
        { value: 'transparent', label: 'Transparent PNG' },
        { value: 'color', label: 'Solid colour background' },
      ],
      help: 'Choose whether to keep the transparent alpha channel or fill it with a solid colour.',
    },
    {
      key: 'color',
      label: 'Background colour',
      type: 'text',
      default: '#ffffff',
      help: 'Hex colour used when Output is "Solid colour background".',
      placeholder: '#ffffff',
      when: { output: 'color' },
    },
    {
      key: 'threshold',
      label: 'Foreground threshold',
      type: 'number',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      help: 'Alpha threshold for the foreground mask (0 = keep everything, 1 = keep only highest-confidence foreground).',
    },
  ],
  examples: [{ title: 'Remove background from a portrait photo' }],
  faq: [
    {
      q: 'Does this upload my images?',
      a: 'No. The model runs locally in your browser. Only the model weights are downloaded once and then cached.',
    },
    {
      q: 'What model is used?',
      a: 'MODNet (Mobile Object Detection Network) via the Xenova/modnet transformers.js port, licensed under Apache-2.0.',
    },
    {
      q: 'Which images work best?',
      a: 'Portraits and subjects with clear separation from the background. Complex scenes, fine hair, or transparent objects may produce imperfect masks.',
    },
    {
      q: 'Can I process multiple images?',
      a: 'One image at a time. For batches, use the tool repeatedly or script it.',
    },
    {
      q: 'Why is the model download large?',
      a: 'The ONNX model is ~8 MB. After the first run it is cached and works offline.',
    },
  ],
  related: ['image-convert', 'image-crop', 'image-resize'],
  credits: [
    {
      name: 'MODNet',
      url: 'https://github.com/ZHKKKe/MODNet',
      license: 'Apache-2.0',
    },
    {
      name: 'Xenova/modnet',
      url: 'https://huggingface.co/Xenova/modnet',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-27',
};