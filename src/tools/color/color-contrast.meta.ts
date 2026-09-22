import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'color-contrast',
  name: 'Color Contrast Checker',
  category: 'color',
  summary: 'Check WCAG 2.1 contrast ratios for foreground/background colour pairs.',
  description:
    'Enter a foreground colour and a background colour to get the WCAG 2.1 contrast ratio, Pass/Fail verdicts for AA/AAA normal and large text plus graphics, and an APCA Lc luminance approximation.',
  keywords: [
    'contrast',
    'wcag',
    'contrast ratio',
    'accessibility',
    'color contrast',
    'aa aaa',
    'apca',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'second',
      label: 'Background colour',
      type: 'textarea',
      default: '#ffffff',
      placeholder: '#ffffff',
    },
  ],
  examples: [
    { title: 'Black on white', input: '#000000' },
    { title: 'Grey on white', input: '#777777' },
  ],
  faq: [
    {
      q: 'What is the APCA value?',
      a: 'APCA (Accessible Perceptual Contrast Algorithm,) the successor to WCAG contrast, estimates perceived contrast in Lc units. This is an approximation off the full APCA 0.0.98G algorithm, labelled "approx".',
    },
  ],
  related: ['color-convert', 'color-palette', 'color-name'],
  status: 'stable',
};
