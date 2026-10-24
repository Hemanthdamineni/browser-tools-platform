import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import bcrypt from 'bcryptjs';
import { meta } from './bcrypt.meta';
import { extractRounds, formatEstimate, looksLikeBcryptHash, validateCost } from './bcrypt.core';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (input.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // `input.text` holds the password. It is used only as bcrypt input and is
  // never echoed into the output, stats, notes, warnings or any log.
  const password = input.text;

  const warnings: string[] = [];
  if (new TextEncoder().encode(password).length > 72) {
    warnings.push('bcrypt only uses the first 72 bytes of the password, so the rest is ignored.');
  }

  if (String(o.mode) === 'verify') {
    const stored = String(o.hash ?? '').trim();
    if (!stored) {
      throw new ToolError('Enter the bcrypt hash to verify against.', 'It cannot be blank.');
    }
    if (!looksLikeBcryptHash(stored)) {
      throw new ToolError(
        'That does not look like a bcrypt hash.',
        'A bcrypt hash starts with $2a$, $2b$, $2x$ or $2y$ and is 60 characters long.',
      );
    }

    const rounds = extractRounds(stored) ?? 10;
    input.onProgress?.(0, 'Comparing');
    const match = bcrypt.compareSync(password, stored);
    input.onProgress?.(1, 'Done');

    return {
      output: match
        ? 'Match — the password belongs to this hash.'
        : 'No match — the password does not belong to this hash.',
      render: 'text',
      stats: {
        mode: 'Verify',
        result: match ? 'Match' : 'No match',
        'hash cost': rounds,
        'estimated time': formatEstimate(rounds),
      },
      warnings: warnings.length ? warnings : undefined,
    };
  }

  const cost = validateCost(o.cost);
  input.onProgress?.(0, 'Hashing');
  const started = performance.now();
  const hash = bcrypt.hashSync(password, cost);
  const elapsed = performance.now() - started;
  input.onProgress?.(1, 'Done');

  return {
    output: hash,
    render: 'code',
    stats: {
      mode: 'Hash',
      cost,
      rounds: 2 ** cost,
      'estimated time': formatEstimate(cost),
      'actual time': `${Math.round(elapsed)} ms`,
      length: hash.length,
    },
    notes: [
      'The random salt and the cost factor are embedded in the hash — store the whole string.',
      `Estimated time at cost ${cost}: ${formatEstimate(cost)} on typical hardware.`,
    ],
    warnings: warnings.length ? warnings : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;