import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'calculator',
  name: 'Expression Calculator',
  category: 'misc',
  summary: 'Evaluate a mathematical expression with a safe parser — no eval, ever.',
  description:
    'Type a maths expression and get the numeric result. The calculator uses a safe recursive-descent parser (no eval, no `new Function`), supporting the four operators, exponentiation, parentheses, common functions, constants and factorials. Trig functions respect the selected angle mode.',
  keywords: [
    'calculator',
    'expression',
    'math',
    'algebra',
    'evaluate',
    'scientific calculator',
    'factorial',
    'trigonometry',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
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
      max: 15,
    },
  ],
  examples: [
    { title: 'Order of operations', input: '2 + 3 * 4' },
    { title: 'Power', input: '(2+3)^2' },
    { title: 'Factorial', input: '5!' },
    { title: 'Trig with pi', input: 'sin(pi/2)' },
  ],
  faq: [
    {
      q: 'Is this expression evaluated safely?',
      a: 'Yes. The expression is parsed and evaluated token by token with a hand-written parser — `eval` and `new Function` are never used, so an expression cannot touch globals or run arbitrary code.',
    },
    {
      q: 'What functions are supported?',
      a: 'sqrt, cbrt, abs, round, floor, ceil, sign, ln, log, log2, exp, sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, min, max, pow, hypot, gcd, factorial, plus the constants pi and e and the postfix factorial operator !.',
    },
  ],
  related: ['programmer-calculator', 'unit-convert', 'percentage'],
  status: 'stable',
};
