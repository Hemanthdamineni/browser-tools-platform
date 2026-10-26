/**
 * E7-T6 + E7-T7 — per-tool persistence and shareable state.
 *
 * Everything stays in the browser: the "remember" opt-in and the per-tool
 * draft are kept in `localStorage`; a shareable snapshot of the current input
 * and options is encoded into the URL hash (`#i=…&o=…`). No server, no
 * analytics, no third parties.
 *
 * The hash is capped so a huge paste never bloats the URL; past the cap the
 * shareable link silently degrades to a plain tool link (input omitted).
 */

import type { OptionValues } from '@/lib/types';

/** localStorage key for the global "remember my input" opt-in. */
export const REMEMBER_FLAG = 'tb-remember-input';
/** Per-tool draft key prefix: `tb-draft-<meta.id>`. */
const DRAFT_PREFIX = 'tb-draft-';
/** Shareable-hash cap, in characters, before we drop the input part. */
export const MAX_HASH_LENGTH = 6000;
/** Shareable-hash cap for the options part alone. */
const MAX_OPTIONS_LENGTH = 2000;

export interface WorkbenchState {
  input: string;
  options: OptionValues;
}

/** Safe localStorage read (a blocked/private store returns null). */
export function storageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Safe localStorage write (a blocked/full store is ignored). */
export function storageSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* non-fatal */
  }
}

export function storageRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* non-fatal */
  }
}

/** Has the user opted in to remembering their last input? */
export function isRememberEnabled(): boolean {
  return storageGet(REMEMBER_FLAG) === '1';
}

/** Persist (or clear) the opt-in flag. */
export function setRememberEnabled(enabled: boolean): void {
  if (enabled) storageSet(REMEMBER_FLAG, '1');
  else storageRemove(REMEMBER_FLAG);
}

/** Save a draft for a tool id. */
export function saveDraft(id: string, state: WorkbenchState): void {
  storageSet(`${DRAFT_PREFIX}${id}`, JSON.stringify(state));
}

/** Load a draft for a tool id, or null when absent / malformed. */
export function loadDraft(id: string): WorkbenchState | null {
  const raw = storageGet(`${DRAFT_PREFIX}${id}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkbenchState>;
    if (typeof parsed.input !== 'string' || typeof parsed.options !== 'object') return null;
    return { input: parsed.input, options: parsed.options as OptionValues };
  } catch {
    return null;
  }
}

export function clearDraft(id: string): void {
  storageRemove(`${DRAFT_PREFIX}${id}`);
}

/** base64url (RFC 4648 §5) — web-safe, no `+ / =` padding. */
export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode input+options into the `#i=…&o=…` hash fragment. */
export function encodeHash(state: WorkbenchState): string {
  const parts: string[] = [];
  const i = state.input;
  if (i.length > 0) parts.push(`i=${base64UrlEncode(i)}`);
  const o = JSON.stringify(state.options);
  if (o !== '{}' && o.length <= MAX_OPTIONS_LENGTH) parts.push(`o=${base64UrlEncode(o)}`);
  const hash = parts.join('&');
  // Cap the whole fragment; dropping the (larger) input first keeps options.
  if (hash.length > MAX_HASH_LENGTH) return `o=${base64UrlEncode(o)}`;
  return hash;
}

/** Parse a hash fragment back into input+options (empty on malformed input). */
export function decodeHash(hash: string): WorkbenchState {
  const clean = hash.replace(/^#/, '');
  const params = new URLSearchParams(clean);
  const out: WorkbenchState = { input: '', options: {} };
  const i = params.get('i');
  const o = params.get('o');
  if (i) {
    try {
      out.input = base64UrlDecode(i);
    } catch {
      /* keep empty */
    }
  }
  if (o) {
    try {
      const parsed = JSON.parse(base64UrlDecode(o)) as unknown;
      if (parsed && typeof parsed === 'object') out.options = parsed as OptionValues;
    } catch {
      /* keep empty */
    }
  }
  return out;
}

/** Is a state empty enough that encoding it would only add noise? */
export function isMeaningful(state: WorkbenchState): boolean {
  return state.input.length > 0 || Object.keys(state.options).length > 0;
}
