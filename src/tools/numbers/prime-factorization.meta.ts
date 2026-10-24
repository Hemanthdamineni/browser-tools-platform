import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'prime-factorization',
  name: 'Prime Factorization Calculator',
  category: 'numbers',
  summary: 'Factor any integer into its prime powers and compute its divisors, totient and sigma.',
  description:
    'Enter a whole number and get its complete prime factorization (p1^e1 × p2^e2 × …), along with the number of divisors τ(n), sum of divisors σ(n), Euler\u2019s totient φ(n), and a primality verdict. The engine uses a deterministic Miller–Rabin test and Pollard\u2019s rho so it handles numbers far beyond 64 bits exactly with arbitrary-precision arithmetic. Additional modes list all primes below a limit or test one number for primality. Everything runs on-device with no uploads.',
  keywords: [
    'prime factorization',
    'factor integer',
    'prime factors',
    'divisors',
    'totient',
    'tau',
    'sigma',
    'miller rabin',
    'pollard rho',
    'is prime',
    'prime list',
    'sieve',
    'coprime',
    'gcd',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'factor',
      choices: [
        { value: 'factor', label: 'Prime factorization' },
        { value: 'is-prime', label: 'Primality test' },
        { value: 'primes-below', label: 'List primes below N' },
      ],
    },
    { key: 'showDivisors', label: 'List divisors', type: 'boolean', default: true },
  ],
  examples: [
    { title: 'Factor 360', input: '360' },
    { title: 'Factor a huge number', input: '612345678901234567891' },
    { title: 'Is it prime?', input: '67280421310721', options: { mode: 'is-prime' } },
  ],
  faq: [
    {
      q: 'How large a number can this handle?',
      a: 'Effectively unlimited. The calculator uses BigInt arithmetic throughout, a deterministic Miller–Rabin primality test, and Pollard\u2019s rho for factoring, so even 30+ digit numbers are factored exactly.',
    },
    {
      q: 'What does φ(n) (totient) mean?',
      a: 'It counts how many integers from 1 to n are coprime with n. For n = p1^e1 … pk^ek it is n × (1 − 1/p1) × … × (1 − 1/pk).',
    },
    {
      q: 'What are τ(n) and σ(n)?',
      a: 'τ(n) is the number of positive divisors (including 1 and n). σ(n) is the sum of all positive divisors. Both follow directly from the prime-power exponents.',
    },
    {
      q: 'What is the lists-primes mode?',
      a: 'It runs the Sieve of Eratosthenes up to your limit and shows the count and the primes (capped for very large limits).',
    },
  ],
  article: [
    {
      heading: 'Three modes in one calculator',
      body: 'Factor mode takes a whole number and returns its prime factorization written as powers — 360 becomes 2³ × 3² × 5 — together with τ(n), the number of divisors, σ(n) the sum of those divisors, φ(n) the totient, and the count of distinct primes. Primality mode answers whether the number is prime or composite with a single verdict plus the number itself, and the primes-below mode runs a sieve up to your limit and reports the count with the first two hundred primes listed. Whichever mode you use, the result comes back as a two-column table of property and value.',
    },
    {
      heading: 'Working with very large integers',
      body: 'All arithmetic is done in arbitrary-precision integers, so the number you type is not rounded to a floating-point approximation the way it would be in a language using 64-bit doubles. A deterministic Miller–Rabin test decides primality and Pollard’s rho finds the factors, which means a thirty-odd-digit number is still factored exactly rather than being reported as prime because a trial division loop gave up. Commas in the input are accepted and stripped, so a number copied from a spreadsheet or an article usually pastes in without editing.',
    },
    {
      heading: 'Reading the arithmetic functions',
      body: 'The three derived values all follow from the prime-power exponents. τ(n) multiplies one plus each exponent, so 360 with exponents 3, 2 and 1 has 4 × 3 × 2 = 24 divisors. σ(n) sums the geometric series for each prime, and φ(n) counts how many integers up to n share no factor with it, computed as n times one minus one over each distinct prime. The divisors list itself is included when the list-divisors option is on, truncated with an ellipsis after five hundred entries so a highly composite number does not flood the table.',
    },
    {
      heading: 'Limits and privacy',
      body: 'The sieve in primes-below mode accepts a limit up to ten million, which is where a browser-tab sieve still finishes quickly; the factor and primality modes have no comparable cap, only the practical cost of factoring a stubborn number. Zero and one have no prime factorization, and the table says so rather than presenting an empty list as though it were zero. Everything is computed locally — the number you are probing never leaves the tab.',
    },
  ],
  related: ['luhn-validator', 'vin-validator', 'barcode-validator', 'unit-convert'],
  status: 'stable',
};
