import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'fluid-clamp',
  name: 'Fluid CSS Clamp Generator',
  category: 'web',
  summary: 'Generate responsive CSS clamp() values between viewport breakpoints.',
  description:
    'Calculate a CSS clamp() expression from minimum and maximum values at two viewport widths. Works for typography, spacing, widths, and other CSS dimensions. Includes the linear interpolation in viewport-width units and requires no JavaScript at runtime.',
  keywords: [
    'CSS clamp generator',
    'fluid typography',
    'responsive spacing',
    'fluid font size calculator',
    'viewport interpolation',
    'clamp CSS calculator',
    'responsive design CSS',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'minValue', label: 'Minimum value', type: 'number', default: 16 },
    { key: 'maxValue', label: 'Maximum value', type: 'number', default: 32 },
    {
      key: 'minViewport',
      label: 'Minimum viewport width (px)',
      type: 'number',
      default: 375,
      min: 1,
    },
    {
      key: 'maxViewport',
      label: 'Maximum viewport width (px)',
      type: 'number',
      default: 1440,
      min: 1,
    },
    {
      key: 'unit',
      label: 'Value unit',
      type: 'select',
      default: 'rem',
      choices: ['px', 'rem', 'em', 'vw'].map((value) => ({ value, label: value })),
    },
    {
      key: 'rootFontSize',
      label: 'Root font size (px)',
      type: 'number',
      default: 16,
      min: 1,
      showWhen: { key: 'unit', value: 'rem' },
    },
    {
      key: 'property',
      label: 'CSS property (optional)',
      type: 'text',
      default: 'font-size',
      placeholder: 'font-size',
    },
    { key: 'precision', label: 'Decimal places', type: 'number', default: 3, min: 0 },
  ],
  examples: [
    {
      title: 'Fluid heading size',
      options: {
        minValue: 16,
        maxValue: 32,
        minViewport: 375,
        maxViewport: 1440,
        unit: 'rem',
        property: 'font-size',
      },
    },
    {
      title: 'Fluid vertical spacing',
      options: {
        minValue: 8,
        maxValue: 48,
        minViewport: 320,
        maxViewport: 1280,
        unit: 'px',
        property: 'padding-block',
      },
    },
    {
      title: 'Fluid container width in px',
      options: {
        minValue: 320,
        maxValue: 1200,
        minViewport: 400,
        maxViewport: 1600,
        unit: 'px',
        property: 'max-width',
      },
    },
  ],
  related: ['css-units', 'aspect-ratio', 'color-contrast'],
  status: 'stable',
};
