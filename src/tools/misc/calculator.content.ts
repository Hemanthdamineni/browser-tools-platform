/**
 * Editorial content for the calculator tool page.
 *
 * Kept out of ``calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
