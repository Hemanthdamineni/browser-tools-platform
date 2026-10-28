import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'upgrade-calculator-scientific',
  name: 'Scientific Calculator',
  category: 'misc',
  summary: 'Scientific calculator with trigonometry, logarithms, constants, statistics, history, and angle modes.',
  description:
    'A complete scientific calculator with an on-screen keypad for easy input. Supports all standard scientific functions: trigonometric (sin, cos, tan, asin, acos, atan, sinh, cosh, tanh), logarithmic (ln, log, log2, log10), exponential (exp, pow, sqrt, cbrt, x^y), constants (π, e, φ, τ), statistical (factorial, permutations, combinations, gcd, lcm), and more. Features calculation history, angle modes (degrees, radians, gradians), and precision control. All evaluation uses a safe recursive-descent parser — no eval, no new Function.',
  keywords: [
    'scientific calculator',
    'calculator with keypad',
    'trigonometric functions',
    'logarithmic functions',
    'scientific calculator online',
    'math calculator',
    'engineering calculator',
    'calculator history',
    'degrees radians gradians',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'scientific-calculator',
  options: [
    {
      key: 'angleMode',
      label: 'Angle mode',
      type: 'select',
      default: 'degrees',
      choices: [
        { value: 'radians', label: 'Radians' },
        { value: 'degrees', label: 'Degrees' },
        { value: 'gradians', label: 'Gradians' },
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
    {
      key: 'showHistory',
      label: 'Show history',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    { title: 'Trigonometry', input: 'sin(30)' },
    { title: 'Logarithms', input: 'ln(10) + log(100)' },
    { title: 'Powers and roots', input: '2^10 + sqrt(144)' },
    { title: 'Constants', input: 'pi * 2' },
    { title: 'Factorial', input: '10!' },
    { title: 'Combinations', input: 'nCr(52, 5)' },
  ],
  faq: [
    {
      q: 'Is this evaluated safely?',
      a: 'Yes. The expression is parsed and evaluated token by token with a hand-written recursive-descent parser — `eval` and `new Function` are never used.',
    },
    {
      q: 'What functions are supported beyond the basic calculator?',
      a: 'Additional functions: asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh, log10, log2, exp, expm1, log1p, cbrt, hypot, deg2rad, rad2deg, grad2rad, rad2grad, nPr, nCr, lcm, min, max, clamp, sign, trunc, ceil, floor, round, random, factorial, and constants pi, e, phi, tau, sqrt2, ln2, ln10, log2e, log10e.',
    },
    {
      q: 'What is the history feature?',
      a: 'Previous calculations are stored in the browser session (not persisted across reloads). Click a history entry to reuse it. History is cleared when you refresh the page.',
    },
    {
      q: 'What angle modes are supported?',
      a: 'Degrees (default), Radians, and Gradians (400 grad = 360°). Trigonometric functions respect the selected mode.',
    },
    {
      q: 'Can I use the keyboard instead of the keypad?',
      a: 'Yes. Type directly in the expression field. The keypad is for convenience on touch devices or for discovering available functions.',
    },
  ],
  related: ['calculator', 'programmer-calculator', 'percentage-calculator'],
  status: 'stable',
};