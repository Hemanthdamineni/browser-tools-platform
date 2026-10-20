import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'aspect-ratio',
  name: 'Aspect Ratio Calculator',
  category: 'misc',
  summary: 'Solve, simplify or look up common aspect ratios and resolutions.',
  description:
    'Work with aspect ratios in three ways: solve a missing width or height from a ratio, reduce a ratio to its simplest form plus the nearest named ratio, or browse common resolutions for a preset family.',
  keywords: ['aspect ratio', '16:9', '4:3', 'resolution', 'screen', 'ratio', 'simplify'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'solve',
      choices: [
        { value: 'solve', label: 'Solve a dimension' },
        { value: 'simplify', label: 'Simplify a ratio' },
        { value: 'presets', label: 'Common resolutions' },
      ],
    },
    {
      key: 'ratioW',
      label: 'Ratio width',
      type: 'number',
      default: 16,
      min: 1,
      showWhen: { key: 'mode', value: 'simplify' },
    },
    {
      key: 'ratioH',
      label: 'Ratio height',
      type: 'number',
      default: 9,
      min: 1,
      showWhen: { key: 'mode', value: 'simplify' },
    },
    {
      key: 'knownWidth',
      label: 'Known width',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'solve' },
    },
    {
      key: 'knownHeight',
      label: 'Known height',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'mode', value: 'solve' },
    },
  ],
  examples: [
    {
      title: 'Real-world resolution',
      input: '',
      options: { mode: 'simplify', ratioW: 1920, ratioH: 1080 },
    },
  ],
  related: ['css-units', 'image-resize'],
  status: 'stable',
};
