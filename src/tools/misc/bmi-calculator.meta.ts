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
  article: [
    {
      heading: 'What you get back',
      body: 'Enter a height and weight in either metric (centimetres and kilograms) or imperial (feet, inches and pounds) and the tool reports the body mass index to one decimal place, the WHO weight category (Underweight, Normal, Overweight or Obese), the healthy weight range for that exact height in kilograms and the BMI Prime — the ratio of your BMI to 25, which sits at the top of the normal band.',
    },
    {
      heading: 'How the units are reconciled',
      body: 'In imperial mode the height is converted as (feet x 12 + inches) x 2.54 to centimetres and the weight as pounds x 0.45359237 to kilograms, so the BMI formula is always the same underneath regardless of which unit picker you use. Values that are zero, negative or non-numeric are refused with a clear message rather than producing a meaningless number.',
    },
    {
      heading: 'What the healthy range is for',
      body: 'The healthy weight range is the kilogram span whose BMI falls between 18.5 and 24.9 — the two category boundaries — recomputed for your entered height. It is a guide to how far you are from the normal band in real weight terms, which is often easier to act on than a dimensionless index.',
    },
    {
      heading: 'What it is not, and privacy',
      body: 'BMI is a screening measure for groups, not a diagnosis: it ignores muscle mass, frame and age, and it tells you nothing about health for any one person. The calculation is done entirely in your browser from the numbers you type, with no storage, no network and no upload, so it works fully offline.',
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
  faq: [
    {
      q: 'What do the categories mean?',
      a: 'Underweight is below 18.5, Normal is 18.5–24.9, Overweight is 25–29.9 and Obese is 30 or above. BMI is a screening measure, not a diagnosis.',
    },
    {
      q: 'What is BMI Prime?',
      a: 'BMI Prime is your BMI divided by 25, the upper edge of the normal band. A value of 1.0 or below sits within the normal range, and each 0.1 above 1.0 is roughly 10% over that boundary.',
    },
    {
      q: 'Is my height and weight stored anywhere?',
      a: 'No. The numbers are converted and the BMI computed in your browser; nothing is saved, uploaded or sent over the network, and the page works offline.',
    },
  ],
  related: ['unit-convert', 'calculator'],
  status: 'stable',
};
