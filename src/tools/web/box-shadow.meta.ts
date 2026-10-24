import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'box-shadow',
  name: 'CSS Box Shadow Generator',
  category: 'web',
  summary: 'Generate box-shadow rules — single or layered soft shadows.',
  description:
    'Configure offset, blur, spread, colour and inset to get a ready-to-paste box-shadow rule. Optional layered mode emits a stack of progressively larger, softer shadows for a natural elevation look.',
  keywords: [
    'box shadow',
    'css shadow',
    'shadow generator',
    'elevation',
    'material shadow',
    'layered shadow',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'offsetX', label: 'Offset X (px)', type: 'number', default: 0 },
    { key: 'offsetY', label: 'Offset Y (px)', type: 'number', default: 4 },
    { key: 'blur', label: 'Blur (px)', type: 'number', default: 12, min: 0 },
    { key: 'spread', label: 'Spread (px)', type: 'number', default: 0 },
    { key: 'color', label: 'Colour', type: 'text', default: 'rgba(0,0,0,0.15)' },
    { key: 'inset', label: 'Inset', type: 'boolean', default: false },
    { key: 'layers', label: 'Layers', type: 'number', default: 1, min: 1, max: 6 },
  ],
  examples: [
    { title: 'Default elevation' },
    { title: 'Layered (3 layers)', options: { layers: 3 } },
    {
      title: 'A soft inset ring',
      options: {
        offsetX: 0,
        offsetY: 2,
        blur: 6,
        spread: 0,
        color: 'rgba(0,0,0,0.2)',
        inset: true,
      },
    },
  ],
  article: [
    {
      heading: 'A rule you can paste',
      body: 'Set the horizontal and vertical offset, the blur radius, the spread and a colour, and the tool writes a complete box-shadow declaration you can drop straight into a stylesheet. The result is the finished rule in CSS syntax, so there is nothing to assemble by hand and no chance of transposing the offset and blur values.',
    },
    {
      heading: 'What each value does',
      body: 'Offset X and Y move the shadow relative to the element — a positive Y pushes it down, the usual "light from above" look. Blur softens the edge; 0 gives a hard copy of the box. Spread grows or shrinks the shadow before blurring, so a negative spread tightens it. Inset draws the shadow inside the element, which is how pressed and recessed surfaces are made.',
    },
    {
      heading: 'Layered shadows for believable depth',
      body: 'A single shadow with a big blur looks flat and artificial. Raise Layers to 2–6 and the tool emits several shadows in one declaration, each with a fraction of the offset, blur and spread and a proportionally smaller alpha, so the stack builds a soft, natural elevation rather than a grey halo. The final layer uses the exact values you entered.',
    },
    {
      heading: 'Colour and comma syntax',
      body: 'The colour accepts any CSS colour, but an rgba() value with partial alpha is what makes a shadow feel like light rather than paint — the default is a 15% black. Multiple layers are joined with commas inside the single declaration, which is legal CSS and supported everywhere, so the rule copies as one line.',
    },
    {
      heading: 'Built locally',
      body: 'The declaration is pure string building in this tab — no design service is queried and no styles are uploaded. Your theme colours stay private, and the tool works offline once the page has loaded.',
    },
  ],
  faq: [
    {
      q: 'How does layered mode scale the shadows?',
      a: 'Layer i of N uses offset/blur/spread multiplied by i/N and the colour alpha divided by i. It mimics the multi-shadow "elevation" technique popularised by Material Design.',
    },
  ],
  related: ['gradient-css', 'color-blend'],
  status: 'stable',
};
