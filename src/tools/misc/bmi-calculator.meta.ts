import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bmi-calculator',
  name: 'BMI Calculator',
  category: 'misc',
  summary: 'Calculate body mass index from metric or imperial measurements.',
  description:
    'Enter a height and weight — in metric or imperial units — to get the body mass index, the WHO weight category, the healthy weight range for that height and the BMI Prime value.',
  keywords: [
    'bmi',
    'body mass index',
    'healthy weight',
    'weight category',
    'underweight',
    'overweight',
    'obese',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'units',
      label: 'Units',
      type: 'select',
      default: 'metric',
      choices: [
        { value: 'metric', label: 'Metric (kg, cm)' },
        { value: 'imperial', label: 'Imperial (lb, ft/in)' },
      ],
    },
    {
      key: 'heightCm',
      label: 'Height (cm)',
      type: 'number',
      default: 170,
      min: 1,
      showWhen: { key: 'units', value: 'metric' },
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      type: 'number',
      default: 70,
      min: 1,
      showWhen: { key: 'units', value: 'metric' },
    },
    {
      key: 'heightFt',
      label: 'Height (feet)',
      type: 'number',
      default: 5,
      min: 1,
      step: 1,
      showWhen: { key: 'units', value: 'imperial' },
    },
    {
      key: 'heightIn',
      label: 'Height (inches)',
      type: 'number',
      default: 7,
      min: 0,
      step: 1,
      showWhen: { key: 'units', value: 'imperial' },
    },
    {
      key: 'weightLb',
      label: 'Weight (lb)',
      type: 'number',
      default: 154,
      min: 1,
      showWhen: { key: 'units', value: 'imperial' },
    },
  ],
  examples: [
    {
      title: 'Metric, 170cm / 70kg',
      input: '',
      options: { units: 'metric', heightCm: 170, weightKg: 70 },
    },
    {
      title: 'Imperial, 5ft 7in / 154lb',
      input: '',
      options: { units: 'imperial', heightFt: 5, heightIn: 7, weightLb: 154 },
    },
    {
      title: 'Tall and light — underweight',
      input: '',
      options: { units: 'metric', heightCm: 190, weightKg: 60 },
    },
  ],
  related: ['unit-convert', 'calculator'],
  status: 'stable',
};
