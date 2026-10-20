import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './totp-authenticator.meta';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32decode(input: string): Uint8Array | null {
  const cleaned = input.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');
  if (!/^[A-Z2-7]+$/.test(cleaned)) return null;
  const bits: number[] = [];
  for (const ch of cleaned) {
    const v = B32.indexOf(ch);
    for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] ?? 0);
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  if (!crypto?.subtle) throw new ToolError('WebCrypto (crypto.subtle) is not available in this environment.');
  // Fresh ArrayBuffer-backed copies: TS requires BufferSource to be Uint8Array<ArrayBuffer>.
  const keyBuf = new Uint8Array(key);
  const msgBuf = new Uint8Array(message);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msgBuf));
  return sig;
}

async function totp(secretBytes: Uint8Array, counter: number, digits: number): Promise<string> {
  const counterBytes = new Uint8Array(8);
  for (let shift = 7; shift >= 0; shift--) counterBytes[7 - shift] = Math.floor(counter / 256 ** shift) % 256;
  const digest = await hmacSha1(secretBytes, counterBytes);
  const offset = digest[digest.length - 1]! & 0x0f;
  const bin = ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!;
  const mod = 10 ** digits;
  return String(bin % mod).padStart(digits, '0');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const digits = Number(o.digits);
  const period = Number(o.period);
  const secret = input.text.trim();
  if (!secret) return { output: JSON.stringify({ headers: ['Window', 'Code', 'Detail'], rows: [] as string[][] }), render: 'table', notes: ['Paste the base32 secret from your otpauth:// URI, e.g. JBSWY3DPEHPK3PXP.'] };
  const tokens = secret.split(/\s+/);
  let secretPart = secret.replace(/\s+/g, '');
  let provided = '';
  if (mode === 'verify') {
    provided = tokens.at(-1) ?? '';
    secretPart = tokens.slice(0, -1).join('');
  }
  const bytes = b32decode(secretPart);
  if (!bytes) throw new ToolError('Invalid base32 secret — use only A–Z and 2–7, optionally with spaces.');
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  const current = await totp(bytes, counter, digits);
  if (mode === 'verify') {
    if (!/^\d+$/.test(provided)) throw new ToolError('Verify mode expects the secret followed by the code to check (e.g. "JBSWY3DPEHPK3PXP 123456"). Use the codes mode to see current codes.');
    const prev = await totp(bytes, counter - 1, digits);
    const next = await totp(bytes, counter + 1, digits);
    const ok = provided === current || provided === prev || provided === next;
    const rows = [[provided, ok ? 'Valid' : 'Invalid', ok ? `Matches the ${provided === current ? 'current' : provided === prev ? 'previous' : 'next'} window.` : `Expected ${current} (or ${prev}/${next} within tolerance).`]];
    return { output: JSON.stringify({ headers: ['Code', 'Result', 'Detail'], rows }), render: 'table', stats: { valid: ok ? 'yes' : 'no' }, notes: [`Verified against the ${period}s window with ±1 step tolerance.`, 'TOTP codes are time-sensitive.'] };
  }
  const previous = await totp(bytes, counter - 1, digits);
  const next = await totp(bytes, counter + 1, digits);
  const remaining = period - (now % period);
  const rows = [['Current', current, `${remaining}s left`], ['Previous', previous, 'Last window'], ['Next', next, 'Next window']];
  return { output: JSON.stringify({ headers: ['Window', 'Code', 'Detail'], rows }), render: 'table', stats: { digits, period, valid: 'yes', refreshIn: remaining }, notes: [`Codes shown for a ${period}-second period with ${digits} digits.`, 'Nothing is stored or uploaded — the secret stays in this browser tab.'] };
}

const tool: TextToolModule = { meta, run };
export { totp, b32decode };
export default tool;
