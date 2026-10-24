/**
 * Pure helpers for the bcrypt tool: cost validation, the estimated-time model,
 * hash-format detection and salt-round extraction. No bcryptjs dependency here,
 * so these are trivially unit-testable in Node and in the browser.
 */

import { ToolError } from '@/lib/types';

export const COST_MIN = 4;
export const COST_MAX = 15;

const HASH_RE = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Validate a cost factor. Returns the validated integer cost, or throws a
 * ToolError when the value is outside the supported range or not an integer.
 */
export function validateCost(value: number | string | boolean | undefined): number {
  const cost = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(cost) || cost < COST_MIN || cost > COST_MAX) {
    throw new ToolError(
      `Cost must be an integer between ${COST_MIN} and ${COST_MAX}.`,
      'Lower costs are fast but weak; higher costs are slow but stronger.',
    );
  }
  return cost;
}

/**
 * Rough "how long will bcrypt take" model. bcrypt work doubles for every
 * additional round, so the total work for `cost` rounds is `2 ** cost`.
 * `cost 10` (the bcrypt default) is tuned to roughly 100ms on typical
 * hardware, so we extrapolate from there. Presented as an estimate only.
 */
export function estimateTimeMs(cost: number): number {
  return Math.round(100 * 2 ** (cost - 10));
}

/**
 * Human-friendly estimate such as "~100 ms" or "~1.6 s" or "~4.5 min".
 */
export function formatEstimate(cost: number): string {
  const ms = estimateTimeMs(cost);
  if (ms < 1000) return `~${Math.max(ms, 1)} ms`;
  if (ms < 60_000) return `~${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `~${(ms / 60_000).toFixed(1)} min`;
  return `~${(ms / 3_600_000).toFixed(1)} hr`;
}

/**
 * True when the string looks like a bcrypt hash: `$2a$`, `$2b$`, `$2x$` or
 * `$2y$`, a two-digit round, and a 53-char base64 payload (22 salt + 31 hash).
 */
export function looksLikeBcryptHash(value: string): boolean {
  return HASH_RE.test(value.trim());
}

/**
 * Pull the number of rounds out of a valid-looking bcrypt hash. Returns null
 * when the value does not look like a hash or has no parseable round count.
 */
export function extractRounds(hash: string): number | null {
  if (!looksLikeBcryptHash(hash)) return null;
  const m = hash.trim().match(/^\$2[abxy]\$(\d{2})\$[./A-Za-z0-9]{53}$/);
  return m?.[1] ? Number(m[1]) : null;
}
