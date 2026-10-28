import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ulid.meta';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Encode a 48-bit ms timestamp as the first 10 Crockford chars. */
function encodeTime(ms: number): string {
  let out = '';
  for (let i = 9; i >= 0; i--) {
    const mod = ms % 32;
    out = CROCKFORD[mod] + out;
    ms = (ms - mod) / 32;
  }
  return out;
}

/** Encode an 80-bit random value (BigInt) as 16 Crockford chars. */
function encodeRandom(n: bigint): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    out = CROCKFORD[Number(n % 32n)] + out;
    n >>= 5n;
  }
  return out;
}

function random80(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

/** Decode the first 10 Crockford chars back to milliseconds. */
export function decodeTime(ulid: string): number {
  let ms = 0;
  for (const ch of ulid.slice(0, 10).toUpperCase()) {
    const idx = CROCKFORD.indexOf(ch);
    if (idx < 0) throw new Error('not a ULID');
    ms = ms * 32 + idx;
  }
  return ms;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const count = Math.max(1, Math.floor(Number(o.count ?? 1)));
  const monotonic = Boolean(o.monotonic);
  const lowercase = Boolean(o.lowercase);

  const ids: string[] = [];
  let lastTime = -1;
  let lastRandom = 0n;
  for (let i = 0; i < count; i++) {
    const now = Date.now();
    let random: bigint;
    if (now === lastTime && (monotonic || count > 1)) {
      random = (lastRandom + 1n) & ((1n << 80n) - 1n);
    } else {
      random = random80();
      lastTime = now;
    }
    lastRandom = random;
    let id = encodeTime(now) + encodeRandom(random);
    if (lowercase) id = id.toLowerCase();
    ids.push(id);
  }

  const firstIso = new Date(decodeTime(ids[0] ?? '')).toISOString();
  return {
    output: ids.join('\n'),
    render: 'code',
    filename: 'ulids.txt',
    stats: { generated: count, 'first timestamp (UTC)': firstIso },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
