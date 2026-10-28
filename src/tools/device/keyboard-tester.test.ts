import { describe, it, expect } from 'vitest';
import { meta } from './keyboard-tester.meta';
import {
  ALL_KEYS,
  KEYBOARD_LAYOUT,
  MAIN_ROWS,
  codeToKey,
  describeEvent,
  evaluateGhosting,
  formatCombination,
  keyAccessibleName,
  keyLabel,
  normalizeCode,
  normalizeCodes,
  parseCombination,
  parseKeyToken,
  resolveCode,
  resolveCodeOrThrow,
  resolveCodeSafe,
  isModifierCode,
  MODIFIER_BY_CODE,
  GHOSTING_CHALLENGES,
} from './keyboard-tester.core';
import { parseSession, buildReport } from './keyboard-tester.core';

const codes = (row: (typeof KEYBOARD_LAYOUT)[number]): string[] => row.keys.map((k) => k.code);

/** Call the tool with the options omitted, the way a bare test would. */
const run = (text: string, options: any = {}) =>
  parseSession(text).attempts.map((a) => evaluateGhosting(a.expected, a.pressed));

describe('keyboard-tester meta', () => {
  it('exports the meta', () => {
    expect(meta).toBeDefined();
    expect(meta.id).toBe('keyboard-tester');
    expect(meta.name).toBe('Keyboard Tester');
  });
});

describe('keyboard-tester layout', () => {
  it('KEYBOARD_LAYOUT is defined and non-empty', () => {
    expect(KEYBOARD_LAYOUT).toBeDefined();
    expect(KEYBOARD_LAYOUT.length).toBeGreaterThan(0);
  });

  it('ALL_KEYS contains every key', () => {
    expect(ALL_KEYS.length).toBeGreaterThan(50);
  });

  it('MAIN_ROWS excludes the function row', () => {
    expect(MAIN_ROWS.some((r) => r.id === 'function')).toBe(false);
  });

  it('every key has code, label, row, col', () => {
    for (const row of KEYBOARD_LAYOUT) {
      for (const key of row.keys) {
        expect(key).toHaveProperty('code');
        expect(key).toHaveProperty('label');
        expect(key).toHaveProperty('row');
        expect(key).toHaveProperty('col');
      }
    }
  });
});

describe('core helpers', () => {
  it('normalizeCode returns code or unchanged', () => {
    expect(normalizeCode('keya')).toBe('KeyA');
    expect(normalizeCode('unknown')).toBe('unknown');
  });

  it('normalizeCodes trims and deduplicates', () => {
    expect(normalizeCodes(['ctrl ', ' ctrl ', 'shift'])).toEqual(['ControlLeft', 'ShiftLeft']);
  });

  it('keyLabel returns readable label', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Space')).toBe(' ');
    expect(keyLabel('unknown')).toBe('unknown');
  });

  it('keyAccessibleName returns accessible name', () => {
    expect(keyAccessibleName('KeyA')).toBe('Key A');
    expect(keyAccessibleName('Space')).toBe('Space');
  });

  it('codeToKey respects shift', () => {
    expect(codeToKey('KeyA', true)).toBe('A');
    expect(codeToKey('Digit1', true)).toBe('!');
  });

  it('formatCombination joins with +', () => {
    expect(formatCombination(['Ctrl', 'Shift', 'T'])).toBe('Ctrl + Shift + T');
  });

  it('resolveCodeOrThrow throws on unknown code', () => {
    expect(() => resolveCodeOrThrow('unknown')).toThrow();
  });

  it('isModifierCode identifies modifiers', () => {
    expect(isModifierCode('ControlLeft')).toBe(true);
    expect(isModifierCode('KeyA')).toBe(false);
  });

  it('MODIFIER_BY_CODE maps codes to names', () => {
    expect(MODIFIER_BY_CODE.get('ControlLeft')).toBe('Ctrl');
  });
});

describe('describeEvent', () => {
  it('extracts key properties', () => {
    const event = {
      code: 'KeyA',
      key: 'a',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      type: 'keydown',
    };
    const desc = describeEvent(event);
    expect(desc.code).toBe('KeyA');
    expect(desc.label).toBe('A');
  });
});

describe('evaluateGhosting', () => {
  it('detects pass when all expected are pressed', () => {
    const result = evaluateGhosting(['ShiftLeft', 'KeyC'], ['ShiftLeft', 'KeyC']);
    expect(result.status).toBe('pass');
    expect(result.missing.length).toBe(0);
  });

  it('detects fail when some expected are missing', () => {
    const result = evaluateGhosting(['ShiftLeft', 'KeyC'], ['ShiftLeft']);
    expect(result.status).toBe('fail');
    expect(result.missing).toEqual(['KeyC']);
  });

  it('computes downTogether correctly', () => {
    const result = evaluateGhosting(['ShiftLeft', 'KeyC'], ['ShiftLeft', 'KeyC', 'AltLeft']);
    expect(result.downTogether).toEqual(['ShiftLeft', 'KeyC']);
  });
});

describe('parseCombination and parseKeyToken', () => {
  it('parses simple combination', () => {
    expect(parseCombination('ctrl + shift + t')).toEqual(['ControlLeft', 'ShiftLeft', 'KeyT']);
  });

  it('parses case-insensitive', () => {
    expect(parseCombination('CTRL SHIFT T')).toEqual(['ControlLeft', 'ShiftLeft', 'KeyT']);
  });

  it('parses aliases', () => {
    expect(parseCombination('win + d')).toEqual(['MetaLeft', 'KeyD']);
  });

  it('parseKeyToken returns empty for unknown token', () => {
    expect(parseKeyToken('unknown')).toBe('');
  });
});

describe('keyboard-tester run', () => {
  it('builds a report from a session', () => {
    const session = {
      attempts: [
        {
          combination: 'Ctrl + C',
          expected: ['ControlLeft', 'KeyC'],
          pressed: ['ControlLeft', 'KeyC'],
          missing: [],
          downTogether: ['ControlLeft', 'KeyC'],
          status: 'pass' as const,
          notes: 'All keys registered simultaneously.',
          when: new Date().toISOString(),
        },
      ],
      options: {},
    };
    const result = buildReport(session, {});
    expect(result.text).toContain('Ctrl + C');
    expect(result.text).toContain('pass');
  });
});

describe('keyboard-tester ghosting challenges', () => {
  it('GHOSTING_CHALLENGES contains known combinations', () => {
    expect(GHOSTING_CHALLENGES.length).toBeGreaterThan(0);
    expect(GHOSTING_CHALLENGES.some((c) => c.name === 'Ctrl + C')).toBe(true);
  });
});
