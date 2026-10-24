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
      max: 15,
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
  article: [
    {
      heading: 'A safe expression parser, not eval',
      body: 'Every expression is tokenised and then evaluated by a hand-written recursive-descent parser. There is no `eval` and no `new Function`, so an expression is only ever numbers, operators, parentheses, known function names and the constants pi and e — it can never reach a global, the DOM or the network. The grammar gives the usual precedence: postfix factorial binds tightest, then exponentiation (right-associative, and tighter than a leading minus, so `-3^2` is -9), then unary signs, then multiplication, division and modulo, then addition and subtraction.',
    },
    {
      heading: 'Type it or tap it',
      body: 'You can type straight into the expression field, or use the on-screen keypad. The keypad is laid out like a physical calculator and always shows the digits, the four operators, parentheses, power and factorial. Turning on the scientific keypad reveals a second row with the trigonometric functions, logarithms, square and cube roots, powers of ten and the constants pi and e. The angle mode switches the trigonometric functions between radians and degrees, and the decimal-places setting controls how the result is rounded for display.',
    },
    {
      heading: 'Memory and result checking',
      body: 'The memory keys work like a desk calculator: evaluate something, press M+ or M− to add or subtract the result to or from the register, MR to drop the stored value back into the expression, and MC to clear it. A small badge lights up while a value is stored. Results must be finite — overflow such as `10^400`, division by zero and out-of-domain input such as `sqrt(-1)` are refused with a plain explanation rather than a silent NaN.',
    },
  ],
  faq: [
    {
      q: 'Is this expression evaluated safely?',
      a: 'Yes. The expression is parsed and evaluated token by token with a hand-written parser — `eval` and `new Function` are never used, so an expression cannot touch globals or run arbitrary code.',
    },
    {
      q: 'What functions are supported?',
      a: 'sqrt, cbrt, abs, round, floor, ceil, sign, ln, log, log10, log2, exp, sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, min, max, pow, hypot, gcd, factorial, the postfix factorial operator !, the constants pi and e, and a memory register (M+, M−, MR, MC) on the keypad.',
    },
    {
      q: 'How does the keypad memory work?',
      a: 'M+ adds the current result to memory, M− subtracts it, MR inserts the stored value into your expression, and MC clears the register. Memory is kept in the tab and is never sent anywhere.',
    },
  ],
  related: ['programmer-calculator', 'percentage-calculator', 'unit-convert'],
  status: 'stable',
};
