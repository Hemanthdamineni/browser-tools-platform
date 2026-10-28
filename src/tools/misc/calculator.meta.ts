import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'calculator',
  name: 'Expression Calculator',
  category: 'misc',
  summary: 'Evaluate a mathematical expression with a safe parser — no eval, ever.',
  description:
    'Type a maths expression (or tap it on the keypad) and get the numeric result. The calculator uses a safe recursive-descent parser (no eval, no `new Function`), supporting the four operators, exponentiation, parentheses, common functions, constants, factorials and a memory register. Flip the scientific toggle to reveal the trig, log, root, power and constant keys. Trig functions respect the selected angle mode.',
  keywords: [
    'calculator',
    'expression',
    'math',
    'algebra',
    'evaluate',
    'scientific calculator',
    'keypad',
    'factorial',
    'trigonometry',
    'memory',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'calculator',
  options: [
    {
      key: 'scientific',
      label: 'Scientific keypad',
      type: 'boolean',
      default: false,
      help: 'Adds the trig, log, root, power, factorial and constant keys to the keypad.',
    },
    {
      key: 'angleMode',
      label: 'Angle mode',
      type: 'select',
      default: 'radians',
      choices: [
        { value: 'radians', label: 'Radians' },
        { value: 'degrees', label: 'Degrees' },
      ],
    },
    {
      key: 'precision',
      label: 'Decimal places',
      type: 'number',
      default: 10,
      min: 0,
    },
  ],
  examples: [
    { title: 'Order of operations', input: '2 + 3 * 4' },
    { title: 'Power', input: '(2+3)^2' },
    { title: 'Factorial', input: '5!' },
    { title: 'Trig with pi', input: 'sin(pi/2)' },
    { title: 'Logarithm', input: 'log10(1000)' },
    { title: 'Root', input: 'sqrt(144)' },
    {
      title: 'Sine in degrees',
      input: 'sin(90)',
      options: { scientific: true, angleMode: 'degrees' },
    },
  ],
  related: ['programmer-calculator', 'percentage-calculator', 'unit-convert'],
  status: 'stable',
};
