/**
 * Editorial content for the prime-factorization tool page.
 *
 * Kept out of ``prime-factorization.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
