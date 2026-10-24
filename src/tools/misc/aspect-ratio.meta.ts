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
    {
      title: 'Solve a height from a width',
      input: '',
      options: { mode: 'solve', ratioW: 16, ratioH: 9, knownWidth: 1280 },
    },
  ],
  article: [
    {
      heading: 'Three ways to work with a ratio',
      body: 'The Mode selector chooses what you want done. Solve a dimension takes a ratio plus one known width or height and returns the other side. Simplify a ratio reduces two numbers to their lowest whole form and names the nearest common ratio such as 16:9. Presets lists common resolutions grouped by their ratio family.',
    },
    {
      heading: 'Why both numbers are reduced',
      body: 'Simplify divides both ratio components by their greatest common divisor, so 1920:1080 becomes 16:9. The decimal value is computed alongside and used to pick the closest named ratio within a small tolerance, which is how a slightly unusual resolution still gets a helpful label.',
    },
    {
      heading: 'Solving uses the cross product',
      body: 'In solve mode the tool applies the ratio as a fraction and scales the known side, so width 1280 at 16:9 gives height 720. Exactly one known dimension is allowed, and the result is reported to two decimal places for values that do not come out whole.',
    },
    {
      heading: 'All arithmetic happens locally',
      body: 'Ratios, resolutions and the preset table are plain numbers held in the page. No value is sent to a server and no network connection is made, so the calculation is instant and the numbers never leave your browser.',
    },
  ],
  faq: [
    {
      q: 'How do I solve for a missing width or height?',
      a: 'Pick Solve a dimension, enter the ratio (for example 16 and 9) and supply exactly one known side — the width or the height. The tool computes the other dimension to two decimal places.',
    },
    {
      q: 'What does "nearest common ratio" mean?',
      a: 'It compares the simplified ratio’s decimal value against a small set of familiar ratios (16:9, 4:3, 21:9, 1:1, 3:2 and others) and labels the closest match, so an unusual resolution is easier to recognise.',
    },
    {
      q: 'Can I enter a ratio like 2.39:1?',
      a: 'Yes. The ratio fields accept decimals and the simplifier rounds them to integers before reducing, which is how CinemaScope (2.39:1) appears in the presets. Decimal input is fine in both solve and simplify modes.',
    },
  ],
  related: ['css-units', 'image-resize'],
  status: 'stable',
};
