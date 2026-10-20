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
  related: ['luhn-validator', 'vin-validator', 'barcode-validator', 'unit-convert'],
  status: 'stable',
};
