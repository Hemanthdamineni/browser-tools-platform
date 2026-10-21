import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'background-remover',
  name: 'Remove Image Background',
  category: 'image',
  summary:
    'Remove the background from a photo of a person and export a transparent PNG, on-device.',
  description:
    'Drop in a photo of a person and MODNet cuts the subject out on your device. Export a transparent PNG, or flatten the subject onto a solid colour you pick. The photo never leaves your browser — only the model weights are downloaded, once.',
  keywords: [
    'remove background',
    'background remover',
    'transparent png',
    'cut out photo',
    'portrait matting',
    'modnet',
    'cutout',
  ],
  privacy: { processing: 'on-device', network: ['huggingface.co'], offline: false },
  input: 'file',
  accept: 'image/*',
  options: [
    {
      key: 'background',
      label: 'Background colour',
      type: 'text',
      default: 'transparent',
      placeholder: 'transparent or #ffffff',
      help: 'Leave as “transparent” for a see-through PNG, or enter a hex colour such as #ffffff to flatten the subject onto it.',
    },
    {
      key: 'cutoff',
      label: 'Edge cutoff',
      type: 'range',
      min: 0,
      max: 128,
      step: 1,
      default: 0,
      help: 'Removes faint background haze left around the subject. 0 keeps the soft edge exactly as the model produced it.',
    },
  ],
  faq: [
    {
      q: 'Does my photo get uploaded?',
      a: 'No. The model runs in your browser and the image is never sent anywhere. The only download is the model weights themselves, from the Hugging Face Hub, the first time you use the tool. They are then cached in your browser.',
    },
    {
      q: 'What exactly does the model do?',
      a: 'It uses MODNet, a portrait-matting network: it estimates a soft alpha matte for the person in the picture and everything around them becomes transparent. It is a portrait model — it is built for people, not for products, pets or scenery.',
    },
    {
      q: 'Will it work on a photo of a landscape or an object?',
      a: 'Probably not well. MODNet was trained on portraits of people. On a landscape it usually keeps most of the frame, and on a product shot it may find no subject at all. The result says so when the matte looks empty or covers everything.',
    },
    {
      q: 'How big is the download?',
      a: 'About 6 MB of model weights, fetched once from the Hugging Face Hub. They are then cached in your browser, so later runs start immediately.',
    },
    {
      q: 'Why do the edges look soft?',
      a: 'The model returns a soft matte, not a hard cut-out, so hair and edges keep their natural falloff. Raise the edge cutoff to remove the faint halo some backgrounds leave behind.',
    },
    {
      q: 'What format comes out?',
      a: 'Always PNG — it is the only widely supported image format that keeps an alpha channel. When you pick a solid background the PNG is flattened and fully opaque.',
    },
  ],
  related: ['image-compress', 'image-resize', 'image-rotate'],
  credits: [
    {
      name: 'MODNet (Xenova/modnet)',
      url: 'https://huggingface.co/Xenova/modnet',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-21',
};
