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
  article: [
    {
      heading: 'What it does and what comes out',
      body: 'Drop in a photo of a person and this tool runs the MODNet portrait-matting model in your browser to estimate a soft alpha matte for the subject, then writes a PNG where everything around the person is transparent. You can leave the background transparent or type a hex colour such as #ffffff to flatten the subject onto it. The output is always PNG, the one widely supported format that carries an alpha channel.',
    },
    {
      heading: 'When it is the right tool',
      body: 'Use it for a headshot that needs a plain background, a profile picture, a speaker photo for a slide, or a cut-out to drop into a design. It is a portrait model: hair, shoulders and soft edges are what it was trained on. A product shot, a pet or a landscape is outside its training and usually comes back with the whole frame kept or almost nothing selected.',
    },
    {
      heading: 'The two options',
      body: 'Background colour controls the result: the word transparent gives a see-through PNG, and any hex colour flattens the subject onto that solid fill and makes the PNG fully opaque. Edge cutoff, from 0 to 128, trims faint background haze left as a halo around the subject; at 0 the soft edge is exactly what the model produced, and raising it eats into that softness to remove the fringe.',
    },
    {
      heading: 'Limits to expect',
      body: 'The matte is soft by design, so hair and edges keep their natural falloff rather than a hard cut. Reinforcement of the model happens the first time you use the tool: about 6 MB of weights are fetched from the Hugging Face Hub and then cached by your browser, so later runs start immediately. Very large photos take longer, and a matte that covers everything or is empty is reported rather than silently exported.',
    },
    {
      heading: 'What leaves your device',
      body: 'Your photo does not. The model runs on your device and the image is never uploaded — the only network traffic is the one-time download of the model weights themselves. After that first run the tool works without contacting anything.',
    },
  ],
  examples: [
    {
      title: 'Transparent cut-out on the default setting',
      options: { background: 'transparent' },
    },
    { title: 'Flatten onto white', options: { background: '#ffffff', cutoff: 0 } },
    {
      title: 'Remove a halo against a coloured backdrop',
      options: { background: '#eef2ff', cutoff: 24 },
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
