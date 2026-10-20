import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './prime-factorization.meta';

type Row = [string, string];

// ── BigInt helpers ────────────────────────────────────────────────────────────

function abs(x: bigint): bigint { return x < 0n ? -x : x; }
function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return r;
}

// ── Miller–Rabin (deterministic for common ranges) ─────────────────────────

// Base sets are deterministic for n < 3.3e24 (enough for an on-device tool).
const MR_BASES: Record<number, bigint[]> = {
  // covers every n < 2^64
  0: [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n],
  // larger n: extend with the first primes
  1: [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n],
};

function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  const bases = Number(n) > Number.MAX_SAFE_INTEGER ? MR_BASES[1]! : MR_BASES[0]!;
  for (const a of bases) {
    if (a % n === 0n) continue;
    let x = modpow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) { composite = false; break; }
    }
    if (composite) return false;
  }
  return true;
}

// ── Pollard's rho ─────────────────────────────────────────────────────────────

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a < 0n ? -a : a;
}

function rho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n;
  if (n % 3n === 0n) return 3n;
  const c = BigInt(Math.floor(Math.random() * Number(n % 20n)) + 1);
  let x = 2n, y = 2n, d = 1n;
  const f = (x: bigint) => (x * x + c) % n;
  while (d === 1n) {
    x = f(x);
    y = f(f(y));
    d = gcd(abs(x - y), n);
  }
  return d === n ? rho(n) : d;
}

// ── Factorization ────────────────────────────────────────────────────────────

function factorize(n: bigint): Map<bigint, number> {
  if (n < 2n) return new Map();
  const res = new Map<bigint, number>();
  const stack: bigint[] = [n];
  while (stack.length) {
    const v = stack.pop()!;
    if (v < 2n) continue;
    if (isPrime(v)) {
      res.set(v, (res.get(v) ?? 0) + 1);
    } else {
      const d = rho(v);
      stack.push(d, v / d);
    }
  }
  return res;
}

// ── Derived number theory ─────────────────────────────────────────────────────

function countDivisors(factors: Map<bigint, number>): bigint {
  let d = 1n;
  for (const [, e] of factors) d *= BigInt(e + 1);
  return d;
}

function sigma(factors: Map<bigint, number>): bigint {
  let s = 1n;
  for (const [p, e] of factors) {
    let term = 0n;
    let pow = 1n;
    for (let i = 0; i <= e; i++) { term += pow; pow *= p; }
    s *= term;
  }
  return s;
}

function phi(factors: Map<bigint, number>, n: bigint): bigint {
  let tot = n;
  for (const [p] of factors) tot = tot - tot / p;
  return tot;
}

// ── Divisor listing (up to 10 000) ────────────────────────────────────────────

function listDivisors(factors: Map<bigint, number>): bigint[] {
  const primes = [...factors.keys()];
  const exps = primes.map((p) => factors.get(p)!);
  const divs: bigint[] = [];
  function dfs(i: number, cur: bigint) {
    if (i === primes.length) { divs.push(cur); return; }
    let v = 1n;
    for (let e = 0; e <= exps[i]!; e++) { dfs(i + 1, cur * v); v *= primes[i]!; }
  }
  dfs(0, 1n);
  return divs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ── Sieve of Eratosthenes ─────────────────────────────────────────────────────

function primesBelow(n: bigint): bigint[] {
  if (n < 2n) return [];
  const limit = Number(n);
  const sieve = new Uint8Array(limit + 1);
  const primes: bigint[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!sieve[i]) {
      primes.push(BigInt(i));
      if (i * i <= limit) for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
    }
  }
  return primes;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt(x: bigint): string {
  const s = x.toString();
  if (s.length <= 3) return s;
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return s.length <= 18 ? grouped : `${grouped} (${s.length} digits)`;
}

function factorizationString(factors: Map<bigint, number>): string {
  const parts: string[] = [];
  for (const [p, e] of [...factors.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    parts.push(e === 1 ? fmt(p) : `${fmt(p)}^${e}`);
  }
  return parts.join(' × ');
}

// ── Main run ──────────────────────────────────────────────────────────────────

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const showDiv = Boolean(o.showDivisors);
  const raw = input.text.trim();
  if (!raw) {
    return { output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }), render: 'table', notes: ['Enter a whole number to factorize, test for primality, or list primes below N.'] };
  }

  const lines = raw.split(/\r\n|\r|\n/).filter((l) => l.trim());
  const text = lines[0]!;

  if (!/^-?[\d,]+$/.test(text.replace(/\s/g, ''))) {
    throw new ToolError('Enter a valid whole number (e.g. 360, -42, 1000000).');
  }

  const clean = text.replace(/,/g, '').trim();
  const n = BigInt(clean);
  const absn = abs(n);

  if (mode === 'primes-below') {
    if (absn > 10000000n) throw new ToolError('The primes-below mode is limited to N ≤ 10,000,000 for performance.');
    const ps = primesBelow(absn);
    const countRow: Row = ['Prime count', String(ps.length)];
    const listRows: Row[] = ps.slice(0, 200).map((p, i) => [String(i + 1), fmt(p)]);
    return {
      output: JSON.stringify({ headers: ['#', 'Prime'], rows: [countRow, ...listRows] }),
      render: 'table',
      stats: { primeCount: ps.length, limit: Number(absn) },
      notes: [ps.length > 200 ? `Showing first 200 of ${ps.length} primes.` : `All ${ps.length} prime numbers below ${fmt(absn)}.`],
    };
  }

  if (mode === 'is-prime') {
    const prime = absn >= 2n && isPrime(absn);
    const rows: Row[] = [['Number', clean], ['Primality', prime ? 'PRIME' : 'COMPOSITE'], ['Absolute value', fmt(absn)]];
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
      render: 'table',
      stats: { isPrime: prime ? 1 : 0 },
      notes: [prime ? `${fmt(absn)} is a prime number (only divisible by 1 and itself).` : `${fmt(absn)} is composite — it has non-trivial divisors.`],
    };
  }

  // factor mode
  const factors = factorize(absn);
  const rows: Row[] = [
    ['Input', clean],
    ['Absolute value', fmt(absn)],
    ['Prime factorization', factors.size ? factorizationString(factors) : '(none)'],
  ];
  if (n < 0n) rows.push(['Sign', 'negative']);
  if (factors.size) {
    const τ = countDivisors(factors);
    const σ = sigma(factors);
    const φ = phi(factors, absn);
    rows.push(['τ(n) — divisors', fmt(τ)]);
    rows.push(['σ(n) — sum of divisors', fmt(σ)]);
    rows.push(['φ(n) — totient', fmt(φ)]);
    rows.push(['Unique primes', String(factors.size)]);
    if (showDiv) {
      const divs = listDivisors(factors);
      const maxDivs = 500;
      rows.push(['Divisors', divs.slice(0, maxDivs).map(fmt).join(', ') + (divs.length > maxDivs ? ' …' : '')]);
      rows.push(['Total divisors', fmt(τ)]);
    }
  }
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: { divisors: factors.size ? Number(countDivisors(factors)) : 0, phi: factors.size ? Number(phi(factors, absn)) : 0, ...(factors.size ? { primes: factors.size } : {}) },
    notes: [absn >= 2n && factors.size === 1 ? `${fmt(absn)} is prime.` : factors.size ? `${fmt(absn)} = ${factorizationString(factors)} — ${countDivisors(factors)} total divisors.` : `${fmt(absn)} has no prime factors (value < 2).`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
