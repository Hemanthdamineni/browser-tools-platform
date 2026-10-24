import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'signature-maker',
  name: 'Signature Maker',
  category: 'generators',
  summary:
    'Draw a signature or type one in a cursive style, then export it as a transparent PNG or SVG.',
  description:
    'Create a clean, transparent signature on this page. Draw it freehand with a mouse, finger or stylus, or type a name and pick a cursive or classic style, then download it as a transparent PNG or SVG that you can drop onto a document, image or form. Everything is produced in this tab — nothing is uploaded and no fonts are fetched.',
  keywords: [
    'signature',
    'signature maker',
    'sign generator',
    'draw signature',
    'typed signature',
    'e-signature',
    'transparent png signature',
    'svg signature',
    'signature generator',
    'autograph',
    'sign here',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  // Drawing and typing need a live pad the generic text form cannot express,
  // so the tool opts into its own panel. The options below are what the panel
  // drives; `run()` reads them through `resolveOptions` and stays usable
  // without the UI.
  panel: 'signature-maker',
  options: [
    {
      key: 'mode',
      label: 'Signature source',
      type: 'select',
      default: 'draw',
      choices: [
        { value: 'draw', label: 'Draw it' },
        { value: 'type', label: 'Type it' },
      ],
    },
    {
      key: 'color',
      label: 'Ink colour',
      type: 'select',
      default: '#111827',
      choices: [
        { value: '#111827', label: 'Black' },
        { value: '#1d4ed8', label: 'Blue' },
        { value: '#b91c1c', label: 'Red' },
        { value: '#047857', label: 'Green' },
      ],
    },
    {
      key: 'strokeWidth',
      label: 'Stroke width (px)',
      type: 'number',
      default: 3,
      min: 1,
      max: 12,
      showWhen: { key: 'mode', value: 'draw' },
    },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'script',
      showWhen: { key: 'mode', value: 'type' },
      choices: [
        { value: 'script', label: 'Script' },
        { value: 'classic', label: 'Classic' },
        { value: 'modern', label: 'Modern' },
        { value: 'mono', label: 'Typewriter' },
      ],
    },
    {
      key: 'size',
      label: 'Font size (px)',
      type: 'number',
      default: 180,
      min: 16,
      max: 512,
      showWhen: { key: 'mode', value: 'type' },
    },
  ],
  examples: [
    {
      title: 'Draw a signature',
      input: JSON.stringify([
        [
          [20, 40],
          [30, 80],
          [40, 80],
        ],
      ]),
    },
    {
      title: 'Type a signature',
      input: 'Ada Lovelace',
      options: { mode: 'type' },
    },
  ],
  faq: [
    {
      q: 'Is the signature transparent?',
      a: 'Yes. The pad is transparent and only the ink is exported, so the signature drops cleanly onto white or any other page colour. SVG export has no background element at all.',
    },
    {
      q: 'Is the PNG or SVG lossless?',
      a: 'Both. SVG is a vector that scales to any size without blur, and the PNG is exported at the full drawing resolution so it stays sharp when scaled down.',
    },
    {
      q: 'Where do the typed fonts come from?',
      a: 'They are generic font stacks already on your device — cursive, serif, sans-serif and monospace. Nothing is fetched from the web, so the tool works offline and no font licence needs to be carried.',
    },
  ],
  related: ['placeholder-svg', 'data-uri', 'pdf-sign'],
  article: [
    {
      heading: 'What the signature maker does',
      body: 'A signature pad and a typed-name form side by side. Draw with a mouse, finger or stylus on the transparent pad, or type a name and pick a cursive, classic, modern or typewriter style. Whatever you make appears in the preview, and you download it as a transparent PNG or SVG that can be dropped onto a document, image, email or web form.',
    },
    {
      heading: 'When to use it',
      body: 'Whenever you need your own mark as an image file — a contract, a PDF, an approval box on a screenshot, or a digital watermark. Because the export keeps only the ink and nothing else, it sits on any background colour without a white box around it.',
    },
    {
      heading: 'The two export formats',
      body: 'SVG is a vector: a few hundred bytes that stays razor sharp at any size, so it is ideal for print or for committing to a codebase. PNG is the pixel version, exported at the full drawing resolution, which most document editors expect. Both keep their alpha channel, so the background stays transparent.',
    },
    {
      heading: 'How the strokes stay smooth',
      body: 'The pad records the raw pointer positions and runs a corner-cutting smoothing pass over them before drawing. That takes the jitter out of a finger or mouse trace while keeping the stroke exactly where you drew it, from the first touch to the last.',
    },
    {
      heading: 'Privacy and fonts',
      body: 'Everything is produced in this tab: the strokes are never uploaded, and the typed signature uses generic system fonts — cursive, serif, sans-serif and monospace — so no webfont is fetched and no font licence needs to be carried. The tool works fully offline.',
    },
  ],
  status: 'stable',
};
