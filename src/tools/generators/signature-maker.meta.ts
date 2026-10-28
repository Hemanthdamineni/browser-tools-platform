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
    {
      title: 'Type in a typewriter style',
      input: 'Grace Hopper',
      options: { mode: 'type', style: 'mono' },
    },
  ],
  related: ['placeholder-svg', 'data-uri', 'pdf-sign'],
  status: 'stable',
};
