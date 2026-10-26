import { describe, it, expect } from 'vitest';
import { getContent } from '@/lib/content';
import { ToolError, type OptionValues } from '@/lib/types';
import tool, {
  buildReport,
  formatTimestamp,
  parseSession,
  runKeyboardTester,
  type GhostingAttempt,
} from './keyboard-tester.tool';
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
  parseCombination,
  parseKeyToken,
} from './keyboard-tester.core';

/** The codes of a layout row, in order. */
const codes = (row: (typeof KEYBOARD_LAYOUT)[number]): string[] => row.keys.map((k) => k.code);

/** Call the tool with the options omitted, the way a bare test would. */
const run = (text: string, options: OptionValues = {}) => runKeyboardTester({ text, options });

/** A recorded session with the given rollover attempts. */
const session = (attempts: GhostingAttempt[], events: unknown[] = []) =>
  JSON.stringify({ attempts, events, pressed: [] });

describe('keyboard-tester meta', () => {
  it('is a beta device tool that runs entirely on-device', () => {
    expect(tool.meta.id).toBe('keyboard-tester');
    expect(tool.meta.category).toBe('device');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.panel).toBe('keyboard-tester');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('points at related tools that really exist', () => {
    expect(tool.meta.related?.length).toBeGreaterThan(0);
    for (const id of tool.meta.related ?? []) {
      expect(typeof id).toBe('string');
    }
  });

  it('explains that a failed rollover test is not necessarily the page’s fault', () => {
    const faq = getContent(tool.meta.id)?.faq ?? [];
    expect(faq.length).toBeGreaterThan(0);
    expect(faq.map((f) => `${f.q} ${f.a}`).join(' ')).toMatch(/operating system/i);
  });
});

describe('keyboard-tester layout', () => {
  it('has the expected number of keys in every row', () => {
    expect(KEYBOARD_LAYOUT.map((row) => row.keys.length)).toEqual([13, 14, 14, 13, 12, 8]);
  });

  it('lays the keys out as a US QWERTY board', () => {
    const [functionRow, numberRow, qwerty, asdf, zxcv, bottom] = KEYBOARD_LAYOUT;
    expect(codes(functionRow!)).toEqual([
      'Escape',
      'F1',
      'F2',
      'F3',
      'F4',
      'F5',
      'F6',
      'F7',
      'F8',
      'F9',
      'F10',
      'F11',
      'F12',
    ]);
    expect(codes(numberRow!)).toEqual([
      'Backquote',
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4',
      'Digit5',
      'Digit6',
      'Digit7',
      'Digit8',
      'Digit9',
      'Digit0',
      'Minus',
      'Equal',
      'Backspace',
    ]);
    expect(codes(qwerty!)).toEqual([
      'Tab',
      'KeyQ',
      'KeyW',
      'KeyE',
      'KeyR',
      'KeyT',
      'KeyY',
      'KeyU',
      'KeyI',
      'KeyO',
      'KeyP',
      'BracketLeft',
      'BracketRight',
      'Backslash',
    ]);
    expect(codes(asdf!)).toEqual([
      'CapsLock',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyF',
      'KeyG',
      'KeyH',
      'KeyJ',
      'KeyK',
      'KeyL',
      'Semicolon',
      'Quote',
      'Enter',
    ]);
    expect(codes(zxcv!)).toEqual([
      'ShiftLeft',
      'KeyZ',
      'KeyX',
      'KeyC',
      'KeyV',
      'KeyB',
      'KeyN',
      'KeyM',
      'Comma',
      'Period',
      'Slash',
      'ShiftRight',
    ]);
    expect(codes(bottom!)).toEqual([
      'ControlLeft',
      'MetaLeft',
      'AltLeft',
      'Space',
      'AltRight',
      'MetaRight',
      'ContextMenu',
      'ControlRight',
    ]);
  });

  it('uses every code exactly once', () => {
    const all = ALL_KEYS.map((key) => key.code);
    expect(new Set(all).size).toBe(all.length);
    // 13 function + 14 number + 14 qwerty + 13 asdf + 12 zxcv + 8 bottom.
    expect(all.length).toBe(74);
  });

  it('gives every main row the same total width', () => {
    for (const row of MAIN_ROWS) {
      const total = row.keys.reduce((sum, key) => sum + key.width, 0);
      expect(total).toBe(15);
    }
  });

  it('gives every key an accessible name that contains its visible label', () => {
    for (const key of ALL_KEYS) {
      const name = keyAccessibleName(key.code);
      expect(name.length).toBeGreaterThan(0);
      expect(name.toLowerCase()).toContain(key.label.toLowerCase());
    }
    expect(keyAccessibleName('KeyA')).toBe('Key A');
    expect(keyAccessibleName('Enter')).toBe('Enter');
    expect(keyAccessibleName('Space')).toBe('Space');
  });
});

describe('codeToKey', () => {
  it('maps a letter key to its character', () => {
    expect(codeToKey('KeyA')).toBe('a');
    expect(codeToKey('KeyQ')).toBe('q');
  });

  it('maps a shifted key to the shifted character', () => {
    expect(codeToKey('KeyA', true)).toBe('A');
    expect(codeToKey('Digit1')).toBe('1');
    expect(codeToKey('Digit1', true)).toBe('!');
    expect(codeToKey('Backquote', true)).toBe('~');
    expect(codeToKey('Slash', true)).toBe('?');
  });

  it('maps the modifier keys to their name', () => {
    expect(codeToKey('ShiftLeft')).toBe('Shift');
    expect(codeToKey('ControlRight')).toBe('Control');
    expect(codeToKey('AltLeft')).toBe('Alt');
    expect(codeToKey('MetaLeft')).toBe('Meta');
  });

  it('maps the named keys and the space bar', () => {
    expect(codeToKey('Enter')).toBe('Enter');
    expect(codeToKey('Space')).toBe(' ');
    expect(codeToKey('Backspace')).toBe('Backspace');
  });

  it('returns an empty string for an unknown code', () => {
    expect(codeToKey('NumpadMultiply')).toBe('');
    expect(codeToKey('')).toBe('');
    expect(codeToKey('NotAKey')).toBe('');
  });

  it('normalises codes regardless of case and padding', () => {
    expect(normalizeCode('  keya ')).toBe('KeyA');
    expect(normalizeCode('controlleft')).toBe('ControlLeft');
    expect(normalizeCode('')).toBe('');
  });
});

describe('describeEvent', () => {
  it('describes a plain key press', () => {
    const described = describeEvent({ key: 'a', code: 'KeyA' });
    expect(described.key).toBe('a');
    expect(described.code).toBe('KeyA');
    expect(described.character).toBe('a');
    expect(described.label).toBe('A');
    expect(described.combo).toBe('a');
    expect(described.modifiers).toEqual([]);
    expect(described.repeat).toBe(false);
    expect(described.isModifier).toBe(false);
    expect(described.unknown).toBe(false);
  });

  it('describes a modifier press without repeating the modifier twice', () => {
    const described = describeEvent({ key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(described.modifiers).toEqual(['Shift']);
    expect(described.combo).toBe('Shift');
    expect(described.isModifier).toBe(true);
    expect(described.character).toBe('Shift');
  });

  it('describes a key held together with other modifiers', () => {
    const described = describeEvent({
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(described.modifiers).toEqual(['Ctrl', 'Shift']);
    expect(described.combo).toBe('Ctrl + Shift + T');
    expect(described.character).toBe('T');
  });

  it('marks a repeated event', () => {
    const described = describeEvent({ key: 'a', code: 'KeyA', repeat: true });
    expect(described.repeat).toBe(true);
  });

  it('flags a code that is not on the layout', () => {
    const described = describeEvent({ key: 'Unidentified', code: 'Numpad5' });
    expect(described.unknown).toBe(true);
    expect(described.label).toBe('Numpad5');
    expect(described.character).toBe('');
  });

  it('keeps a Unicode key value unchanged', () => {
    const described = describeEvent({ key: 'ф', code: 'KeyA' });
    expect(described.key).toBe('ф');
    expect(described.character).toBe('a');
    const cjk = describeEvent({ key: '日', code: 'KeyJ' });
    expect(cjk.key).toBe('日');
  });

  it('reports the event type', () => {
    expect(describeEvent({ key: 'a', code: 'KeyA', type: 'keyup' }).type).toBe('keyup');
    expect(describeEvent({ key: 'a', code: 'KeyA', type: 'keydown' }).type).toBe('keydown');
  });
});

describe('evaluateGhosting', () => {
  it('passes when every key of the combination was down', () => {
    const result = evaluateGhosting(
      ['ControlLeft', 'ShiftLeft', 'KeyT'],
      ['ControlLeft', 'ShiftLeft', 'KeyT'],
    );
    expect(result.pass).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.pressed).toHaveLength(3);
  });

  it('fails and names the key that never came down', () => {
    const result = evaluateGhosting(
      ['ControlLeft', 'ShiftLeft', 'KeyT'],
      ['ControlLeft', 'ShiftLeft'],
    );
    expect(result.pass).toBe(false);
    expect(result.missing).toEqual(['KeyT']);
    expect(formatCombination(result.missing)).toBe('T');
  });

  it('fails when a combination is empty', () => {
    expect(() => evaluateGhosting([], [])).toThrow(ToolError);
    expect(() => evaluateGhosting([], [])).toThrow(/at least one key/i);
  });

  it('accepts a case-insensitive, whitespace-padded combination', () => {
    const result = evaluateGhosting(
      ['  controlleft ', 'SHIFTLEFT', ' keyt '],
      ['ControlLeft', 'ShiftLeft', 'KeyT'],
    );
    expect(result.pass).toBe(true);
    expect(result.expected).toEqual(['ControlLeft', 'ShiftLeft', 'KeyT']);
  });

  it('ignores keys that are not part of the combination', () => {
    const result = evaluateGhosting(['KeyA'], ['KeyA', 'KeyB']);
    expect(result.pass).toBe(true);
    expect(result.extra).toEqual(['KeyB']);
  });
});

describe('formatCombination', () => {
  it('formats a single key', () => {
    expect(formatCombination(['KeyT'])).toBe('T');
  });

  it('formats several keys', () => {
    expect(formatCombination(['KeyA', 'KeyS', 'KeyD'])).toBe('A + S + D');
  });

  it('formats modifiers', () => {
    expect(formatCombination(['ControlLeft', 'AltLeft'])).toBe('Ctrl + Alt');
    expect(formatCombination(['ControlLeft', 'ShiftLeft', 'KeyT'])).toBe('Ctrl + Shift + T');
  });

  it('labels unknown codes with their raw code', () => {
    expect(formatCombination(['Numpad7'])).toBe('Numpad7');
  });
});

describe('parseCombination', () => {
  it('parses a written combination into codes', () => {
    expect(parseCombination('ctrl + shift + t')).toEqual(['ControlLeft', 'ShiftLeft', 'KeyT']);
    expect(parseCombination('a s d')).toEqual(['KeyA', 'KeyS', 'KeyD']);
    expect(parseCombination('space')).toEqual(['Space']);
  });

  it('ignores case and padding', () => {
    expect(parseCombination('  CTRL + Shift + T  ')).toEqual(['ControlLeft', 'ShiftLeft', 'KeyT']);
  });

  it('rejects an empty or unknown combination', () => {
    expect(() => parseCombination('   ')).toThrow(ToolError);
    expect(() => parseCombination('ctrl + nonsense')).toThrow(/not a key/i);
  });

  it('maps a single token to a code', () => {
    expect(parseKeyToken('Shift')).toBe('ShiftLeft');
    expect(parseKeyToken('7')).toBe('Digit7');
    expect(parseKeyToken('nope')).toBe('');
  });
});

describe('keyboard-tester run', () => {
  it('rejects empty input', () => {
    expect(() => run('')).toThrow(ToolError);
    expect(() => run('   ')).toThrow(/no key events/i);
  });

  it('rejects malformed input', () => {
    expect(() => run('not json')).toThrow(ToolError);
    expect(() => run('[]')).toThrow(ToolError);
    expect(() => run('{"nope":true}')).toThrow(ToolError);
    expect(() => run('{"attempts":[{"expected":"KeyA"}]}')).toThrow(/malformed/i);
    expect(() => run('{"attempts":[{"expected":[],"pressed":[]}]}')).toThrow(/malformed/i);
  });

  it('reports the rollover attempts as a table', () => {
    const result = run(
      session([
        {
          expected: ['ControlLeft', 'ShiftLeft', 'KeyT'],
          pressed: ['ControlLeft', 'ShiftLeft', 'KeyT'],
          at: '2026-10-22T09:30:00.000Z',
        },
        {
          expected: ['ControlLeft', 'ShiftLeft', 'KeyT'],
          pressed: ['ControlLeft', 'KeyT'],
          at: '2026-10-22T09:31:15.000Z',
        },
      ]),
    );
    expect(result.render).toBe('table');
    const table = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual([
      'Combination',
      'Result',
      'Missing',
      'Down together',
      'When (UTC)',
    ]);
    expect(table.rows[0]).toEqual([
      'Ctrl + Shift + T',
      'PASS',
      '—',
      'Ctrl + Shift + T',
      '09:30:00',
    ]);
    expect(table.rows[1]).toEqual(['Ctrl + Shift + T', 'FAIL', 'Shift', 'Ctrl + T', '09:31:15']);
    expect(result.stats).toMatchObject({ attempts: 2, passed: 1, failed: 1, bestRollover: 3 });
    expect(result.warnings?.join(' ')).toMatch(/keyboard/i);
  });

  it('honours the history size option', () => {
    const attempts: GhostingAttempt[] = [1, 2, 3, 4, 5].map(() => ({
      expected: ['KeyA'],
      pressed: ['KeyA'],
      at: '2026-10-22T09:30:00.000Z',
    }));
    const result = run(session(attempts), { historySize: 2 });
    const table = JSON.parse(result.output) as { rows: string[][] };
    expect(table.rows).toHaveLength(2);
    expect(result.stats?.attempts).toBe(2);
  });

  it('can leave the timestamp column out', () => {
    const result = run(
      session([{ expected: ['KeyA'], pressed: ['KeyA'], at: '2026-10-22T09:30:00.000Z' }]),
      { includeTimestamps: false },
    );
    const table = JSON.parse(result.output) as { headers: string[] };
    expect(table.headers).toEqual(['Combination', 'Result', 'Missing', 'Down together']);
  });

  it('keeps a Unicode key value in the readout unchanged', () => {
    const result = run(
      session(
        [],
        [
          { key: 'ф', code: 'KeyA', type: 'keydown' },
          { key: '日', code: 'KeyJ', ctrlKey: true, type: 'keydown' },
        ],
      ),
    );
    const notes = result.notes?.join(' ') ?? '';
    expect(notes).toContain('ф');
    expect(notes).toContain('日');
    // The last event keeps its own key value and its modifier state.
    expect(notes).toContain('日 (KeyJ)');
    expect(notes).toContain('Ctrl + 日');
  });

  it('says so when there is nothing to report yet', () => {
    const result = run(session([]));
    expect(result.notes?.join(' ')).toMatch(/no rollover attempts yet/i);
    expect(result.warnings).toBeUndefined();
  });

  it('works when the options are omitted', () => {
    const result = runKeyboardTester({
      text: session([{ expected: ['KeyA'], pressed: ['KeyA'], at: '2026-10-22T09:30:00.000Z' }]),
    });
    const table = JSON.parse(result.output) as { rows: string[][] };
    expect(table.rows[0]?.[1]).toBe('PASS');
    expect(result.stats?.rolloverWindowMs).toBe(1200);
  });
});

describe('keyboard-tester helpers', () => {
  it('parses a session and rejects a broken one', () => {
    const parsed = parseSession(
      session([{ expected: ['KeyA'], pressed: [], at: '2026-10-22T09:30:00.000Z' }]),
    );
    expect(parsed.attempts).toHaveLength(1);
    expect(() => parseSession('{')).toThrow(ToolError);
  });

  it('formats a timestamp without a locale', () => {
    expect(formatTimestamp('2026-10-22T09:30:00.000Z')).toBe('09:30:00');
    expect(formatTimestamp('nonsense')).toBe('');
  });

  it('reports a build without attempts', () => {
    const report = buildReport({ attempts: [] }, {});
    expect(report.stats.attempts).toBe(0);
    expect(report.notes.join(' ')).toMatch(/no rollover attempts/i);
  });

  it('labels keys that are not on the layout', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Numpad9')).toBe('Numpad9');
  });
});
