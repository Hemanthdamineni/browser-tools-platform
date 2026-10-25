import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  storageGet,
  storageSet,
  storageRemove,
  isRememberEnabled,
  setRememberEnabled,
  saveDraft,
  loadDraft,
  clearDraft,
  base64UrlEncode,
  base64UrlDecode,
  encodeHash,
  decodeHash,
  isMeaningful,
  REMEMBER_FLAG,
  MAX_HASH_LENGTH,
} from './state';

/** The descriptor jsdom/Node installed, restored after each test that stubs it. */
const realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

/** Install an in-memory store (or a misbehaving one) as `globalThis.localStorage`. */
function useStorage(impl: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): void {
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true });
}

function memoryStorage(): Record<string, string> &
  Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const data: Record<string, string> = {};
  return Object.assign(data, {
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v);
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  });
}

afterEach(() => {
  if (realDescriptor) Object.defineProperty(globalThis, 'localStorage', realDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('localStorage guards', () => {
  beforeEach(() => useStorage(memoryStorage()));

  it('stores and retrieves a value', () => {
    storageSet('k', 'v');
    expect(storageGet('k')).toBe('v');
  });

  it('removes a value', () => {
    storageSet('k', 'v');
    storageRemove('k');
    expect(storageGet('k')).toBeNull();
  });

  it('tolerates a throwing store', () => {
    useStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(storageGet('k')).toBeNull();
    expect(() => storageSet('k', 'v')).not.toThrow();
    expect(() => storageRemove('k')).not.toThrow();
  });
});

describe('remember opt-in', () => {
  beforeEach(() => useStorage(memoryStorage()));

  it('is off by default', () => {
    expect(isRememberEnabled()).toBe(false);
  });

  it('persists the flag', () => {
    setRememberEnabled(true);
    expect(isRememberEnabled()).toBe(true);
    expect(storageGet(REMEMBER_FLAG)).toBe('1');
    setRememberEnabled(false);
    expect(isRememberEnabled()).toBe(false);
    expect(storageGet(REMEMBER_FLAG)).toBeNull();
  });
});

describe('drafts', () => {
  beforeEach(() => useStorage(memoryStorage()));

  it('round-trips a draft', () => {
    const state = { input: 'hello', options: { upper: true } };
    saveDraft('x', state);
    expect(loadDraft('x')).toEqual(state);
    clearDraft('x');
    expect(loadDraft('x')).toBeNull();
  });

  it('returns null when absent or malformed', () => {
    expect(loadDraft('x')).toBeNull();
    storageSet('tb-draft-x', 'not json');
    expect(loadDraft('x')).toBeNull();
    storageSet('tb-draft-x', JSON.stringify({ input: 1 }));
    expect(loadDraft('x')).toBeNull();
  });
});

describe('base64url', () => {
  it('round-trips plain and unicode text', () => {
    for (const s of ['hello', 'héllo wörld ✓', 'a+b/c=d', '']) {
      expect(base64UrlDecode(base64UrlEncode(s))).toBe(s);
    }
  });

  it('produces a URL-safe alphabet', () => {
    const out = base64UrlEncode('\u0000\u0001\u0002\u00ff\u00fe\uffff'.repeat(3));
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe('encodeHash / decodeHash', () => {
  it('round-trips input and options', () => {
    const state = { input: 'some text\nsecond line', options: { upper: true, size: 42 } };
    const hash = encodeHash(state);
    expect(hash.startsWith('i=')).toBe(true);
    expect(hash).toContain('&o=');
    expect(decodeHash(hash)).toEqual(state);
  });

  it('omits empty input from the hash', () => {
    const hash = encodeHash({ input: '', options: { upper: true } });
    expect(hash.startsWith('o=')).toBe(true);
    expect(hash.includes('i=')).toBe(false);
  });

  it('produces an empty hash for a fully empty state', () => {
    expect(encodeHash({ input: '', options: {} })).toBe('');
  });

  it('decodes a bare hash and tolerates a leading #', () => {
    const state = { input: 'hi', options: {} };
    const hash = encodeHash(state);
    expect(decodeHash(`#${hash}`)).toEqual(state);
  });

  it('ignores malformed parameters', () => {
    expect(decodeHash('i=%%%&o=###')).toEqual({ input: '', options: {} });
  });

  it('caps the encoded size and falls back to options-only', () => {
    const state = { input: 'x'.repeat(MAX_HASH_LENGTH * 2), options: { flag: true } };
    const hash = encodeHash(state);
    expect(hash.startsWith('o=')).toBe(true);
    expect(hash.length).toBeLessThanOrEqual(MAX_HASH_LENGTH);
    expect(decodeHash(hash).input).toBe('');
  });
});

describe('isMeaningful', () => {
  it('is false for an empty state', () => {
    expect(isMeaningful({ input: '', options: {} })).toBe(false);
  });
  it('is true when input or options are set', () => {
    expect(isMeaningful({ input: 'a', options: {} })).toBe(true);
    expect(isMeaningful({ input: '', options: { x: 1 } })).toBe(true);
  });
});
