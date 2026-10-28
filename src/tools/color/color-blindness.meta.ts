import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-blindness',
  name: 'Color Blindness Simulator',
  category: 'color',
  summary: 'Simulate protanopia, deuteranopia, tritanopia and achromatopsia on your colors.',
  description:
    'See how one or more colors appear to someone with red-green or blue-yellow color vision deficiency. Uses the standard Viénot/Brettel linear-RGB simulation matrices, blended by severity.',
  keywords: [
    'color blindness',
    'color blind simulator',
    'deuteranopia',
    'protanopia',
    'tritanopia',
    'achromatopsia',
    'accessible colors',
    'cvd',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'type',
      label: 'Deficiency',
      type: 'select',
      default: 'deuteranopia',
      choices: [
        { value: 'protanopia', label: 'Protanopia (no red)' },
        { value: 'deuteranopia', label: 'Deuteranopia (no green)' },
        { value: 'tritanopia', label: 'Tritanopia (no blue)' },
        { value: 'achromatopsia', label: 'Achromatopsia (no color)' },
      ],
    },
    {
      key: 'severity',
      label: 'Severity (%)',
      type: 'range',
      default: 100,
      min: 0,
      max: 100,
      step: 1,
    },
  ],
  examples: [
    { title: 'Pure red', input: '#ff0000' },
    {
      title: 'A palette',
      input: '#ff0000\n#00ff00\n#0000ff',
      options: { type: 'tritanopia' },
    },
  ],
  faq: [
    {
      q: 'Which simulation is this?',
      a: 'The linear-RGB Viénot/Brettel 3x3 matrices commonly used for CVD simulation, blended with the original color by the severity setting. They are an approximation, not a clinical model.',
    },
    {
      q: 'Can I simulate a whole palette?',
      a: 'Enter one color per line - each line is simulated in order.',
    },
  ],
  related: [  "color-contrast",
  "color-palette",
  "color-convert"],
  status: 'stable',
};
