/**
 * Pure keyboard logic for the keyboard tester.
 */
import { ToolError } from '@/lib/types';
import type { OptionValues, TextRunResult } from '@/lib/types';

const HEADERS = ['Combination', 'Result', 'Missing', 'Down together', 'When (UTC)'];

/** Clamp a numeric option into a sane range. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/* -------------------------------------------------------------------------- */
/*  The on-screen layout                                                       */
/* -------------------------------------------------------------------------- */

/** One key on the on-screen layout. */
export interface KeyDef {
  code: string;
  label: string;
  altLabel?: string;
  row: number;
  col: number;
}

/** A horizontal run of keys. */
export interface KeyRow {
  id: string;
  keys: KeyDef[];
}

/** The letter keys of a row, in QWERTY order. */
function letterKeys(letters: string): KeyDef[] {
  return letters.split('').map((letter, i) => ({
    code: letter.toUpperCase(),
    label: letter.toUpperCase(),
    row: 0,
    col: i,
  }));
}

/** The number keys, with the US layout's shifted symbols. */
function digitKeys(): KeyDef[] {
  return [
    { code: 'Digit0', label: '0', altLabel: ')', row: 1, col: 0 },
    { code: 'Digit1', label: '1', altLabel: '!', row: 1, col: 1 },
    { code: 'Digit2', label: '2', altLabel: '@', row: 1, col: 2 },
    { code: 'Digit3', label: '3', altLabel: '#', row: 1, col: 3 },
    { code: 'Digit4', label: '4', altLabel: '$', row: 1, col: 4 },
    { code: 'Digit5', label: '5', altLabel: '%', row: 1, col: 5 },
    { code: 'Digit6', label: '6', altLabel: '^', row: 1, col: 6 },
    { code: 'Digit7', label: '7', altLabel: '&', row: 1, col: 7 },
    { code: 'Digit8', label: '8', altLabel: '*', row: 1, col: 8 },
    { code: 'Digit9', label: '9', altLabel: '(', row: 1, col: 9 },
  ];
}

/**
 * The US-QWERTY layout the panel draws. Every row of the main block is 15 key
 * units wide, exactly like a 60 %-size ANSI board.
 */
export const KEYBOARD_LAYOUT: KeyRow[] = [
  {
    id: 'function',
    keys: [
      { code: 'F1', label: 'F1', row: 0, col: 0 },
      { code: 'F2', label: 'F2', row: 0, col: 1 },
      { code: 'F3', label: 'F3', row: 0, col: 2 },
      { code: 'F4', label: 'F4', row: 0, col: 3 },
      { code: 'F5', label: 'F5', row: 0, col: 4 },
      { code: 'F6', label: 'F6', row: 0, col: 5 },
      { code: 'F7', label: 'F7', row: 0, col: 6 },
      { code: 'F8', label: 'F8', row: 0, col: 7 },
      { code: 'F9', label: 'F9', row: 0, col: 8 },
      { code: 'F10', label: 'F10', row: 0, col: 9 },
      { code: 'F11', label: 'F11', row: 0, col: 10 },
      { code: 'F12', label: 'F12', row: 0, col: 11 },
      { code: 'PrintScreen', label: 'Print', row: 0, col: 12 },
      { code: 'ScrollLock', label: 'Scroll', row: 0, col: 13 },
      { code: 'Pause', label: 'Pause', row: 0, col: 14 },
    ],
  },
  {
    id: 'main',
    keys: [
      { code: 'Backquote', label: '`', altLabel: '~', row: 1, col: 0 },
      { code: 'Digit1', label: '1', altLabel: '!', row: 1, col: 1 },
      { code: 'Digit2', label: '2', altLabel: '@', row: 1, col: 2 },
      { code: 'Digit3', label: '3', altLabel: '#', row: 1, col: 3 },
      { code: 'Digit4', label: '4', altLabel: '$', row: 1, col: 4 },
      { code: 'Digit5', label: '5', altLabel: '%', row: 1, col: 5 },
      { code: 'Digit6', label: '6', altLabel: '^', row: 1, col: 6 },
      { code: 'Digit7', label: '7', altLabel: '&', row: 1, col: 7 },
      { code: 'Digit8', label: '8', altLabel: '*', row: 1, col: 8 },
      { code: 'Digit9', label: '9', altLabel: '(', row: 1, col: 9 },
      { code: 'Digit0', label: '0', altLabel: ')', row: 1, col: 10 },
      { code: 'Minus', label: '-', altLabel: '_', row: 1, col: 11 },
      { code: 'Equal', label: '=', altLabel: '+', row: 1, col: 12 },
      { code: 'Backspace', label: '⌫', row: 1, col: 13 },
      { code: 'Insert', label: 'Ins', row: 1, col: 14 },
    ],
  },
  {
    id: 'main',
    keys: [
      { code: 'Tab', label: 'Tab', row: 2, col: 0 },
      { code: 'KeyQ', label: 'Q', row: 2, col: 1 },
      { code: 'KeyW', label: 'W', row: 2, col: 2 },
      { code: 'KeyE', label: 'E', row: 2, col: 3 },
      { code: 'KeyR', label: 'R', row: 2, col: 4 },
      { code: 'KeyT', label: 'T', row: 2, col: 5 },
      { code: 'KeyY', label: 'Y', row: 2, col: 6 },
      { code: 'KeyU', label: 'U', row: 2, col: 7 },
      { code: 'KeyI', label: 'I', row: 2, col: 8 },
      { code: 'KeyO', label: 'O', row: 2, col: 9 },
      { code: 'KeyP', label: 'P', row: 2, col: 10 },
      { code: 'BracketLeft', label: '[', altLabel: '{', row: 2, col: 11 },
      { code: 'BracketRight', label: ']', altLabel: '}', row: 2, col: 12 },
      { code: 'Backslash', label: '\\', altLabel: '|', row: 2, col: 13 },
      { code: 'Delete', label: 'Del', row: 2, col: 14 },
    ],
  },
  {
    id: 'main',
    keys: [
      { code: 'CapsLock', label: 'Caps', row: 3, col: 0 },
      { code: 'KeyA', label: 'A', row: 3, col: 1 },
      { code: 'KeyS', label: 'S', row: 3, col: 2 },
      { code: 'KeyD', label: 'D', row: 3, col: 3 },
      { code: 'KeyF', label: 'F', row: 3, col: 4 },
      { code: 'KeyG', label: 'G', row: 3, col: 5 },
      { code: 'KeyH', label: 'H', row: 3, col: 6 },
      { code: 'KeyJ', label: 'J', row: 3, col: 7 },
      { code: 'KeyK', label: 'K', row: 3, col: 8 },
      { code: 'KeyL', label: 'L', row: 3, col: 9 },
      { code: 'Semicolon', label: ';', altLabel: ':', row: 3, col: 10 },
      { code: 'Quote', label: "'", altLabel: '"', row: 3, col: 11 },
      { code: 'Enter', label: '↵', row: 3, col: 12 },
      { code: 'PageUp', label: 'PgUp', row: 3, col: 13 },
      { code: 'PageDown', label: 'PgDn', row: 3, col: 14 },
    ],
  },
  {
    id: 'main',
    keys: [
      { code: 'ShiftLeft', label: 'Shift', altLabel: '⇧', row: 4, col: 0 },
      { code: 'KeyZ', label: 'Z', row: 4, col: 1 },
      { code: 'KeyX', label: 'X', row: 4, col: 2 },
      { code: 'KeyC', label: 'C', row: 4, col: 3 },
      { code: 'KeyV', label: 'V', row: 4, col: 4 },
      { code: 'KeyB', label: 'B', row: 4, col: 5 },
      { code: 'KeyN', label: 'N', row: 4, col: 6 },
      { code: 'KeyM', label: 'M', row: 4, col: 7 },
      { code: 'Comma', label: ',', altLabel: '<', row: 4, col: 8 },
      { code: 'Period', label: '.', altLabel: '>', row: 4, col: 9 },
      { code: 'Slash', label: '/', altLabel: '?', row: 4, col: 10 },
      { code: 'ShiftRight', label: 'Shift', altLabel: '⇧', row: 4, col: 11 },
      { code: 'ArrowUp', label: '↑', row: 4, col: 12 },
      { code: 'Up', label: 'Up', row: 4, col: 13 },
      { code: 'Down', label: 'Down', row: 4, col: 14 },
    ],
  },
  {
    id: 'main',
    keys: [
      { code: 'ControlLeft', label: 'Ctrl', row: 5, col: 0 },
      { code: 'MetaLeft', label: '⌘', row: 5, col: 1 },
      { code: 'AltLeft', label: 'Alt', row: 5, col: 2 },
      { code: 'Space', label: ' ', row: 5, col: 3 },
      { code: 'AltRight', label: 'Alt', row: 5, col: 4 },
      { code: 'MetaRight', label: '⌘', row: 5, col: 5 },
      { code: 'ControlRight', label: 'Ctrl', row: 5, col: 6 },
      { code: 'ArrowLeft', label: '←', row: 5, col: 7 },
      { code: 'ArrowDown', label: '↓', row: 5, col: 8 },
      { code: 'ArrowRight', label: '→', row: 5, col: 9 },
      { code: 'End', label: 'End', row: 5, col: 10 },
      { code: 'Home', label: 'Home', row: 5, col: 11 },
      { code: 'Insert', label: 'Ins', row: 5, col: 12 },
    ],
  },
  {
    id: 'numeric',
    keys: [
      { code: 'NumLock', label: 'Num', row: 6, col: 0 },
      { code: 'NumpadDivide', label: '/', row: 6, col: 1 },
      { code: 'NumpadMultiply', label: '*', row: 6, col: 2 },
      { code: 'NumpadSubtract', label: '-', row: 6, col: 3 },
      { code: 'Numpad7', label: '7', row: 6, col: 4 },
      { code: 'Numpad8', label: '8', row: 6, col: 5 },
      { code: 'Numpad9', label: '9', row: 6, col: 6 },
      { code: 'NumpadAdd', label: '+', row: 6, col: 7 },
      { code: 'Numpad4', label: '4', row: 6, col: 8 },
      { code: 'Numpad5', label: '5', row: 6, col: 9 },
      { code: 'Numpad6', label: '6', row: 6, col: 10 },
      { code: 'Numpad1', label: '1', row: 6, col: 11 },
      { code: 'Numpad2', label: '2', row: 6, col: 12 },
      { code: 'Numpad3', label: '3', row: 6, col: 13 },
      { code: 'Numpad0', label: '0', row: 6, col: 14 },
      { code: 'NumpadDecimal', label: '.', row: 6, col: 15 },
      { code: 'NumpadEqual', label: '=', row: 6, col: 16 },
      { code: 'NumpadEnter', label: '↵', row: 6, col: 17 },
      { code: 'NumpadComma', label: ',', row: 6, col: 18 },
    ],
  },
  {
    id: 'function2',
    keys: [
      { code: 'F13', label: 'F13', row: 7, col: 0 },
      { code: 'F14', label: 'F14', row: 7, col: 1 },
      { code: 'F15', label: 'F15', row: 7, col: 2 },
      { code: 'F16', label: 'F16', row: 7, col: 3 },
      { code: 'F17', label: 'F17', row: 7, col: 4 },
      { code: 'F18', label: 'F18', row: 7, col: 5 },
      { code: 'F19', label: 'F19', row: 7, col: 6 },
      { code: 'F20', label: 'F20', row: 7, col: 7 },
      { code: 'F21', label: 'F21', row: 7, col: 8 },
      { code: 'F22', label: 'F22', row: 7, col: 9 },
      { code: 'F23', label: 'F23', row: 7, col: 10 },
      { code: 'F24', label: 'F24', row: 7, col: 11 },
    ],
  },
];

export const ALL_KEYS: KeyDef[] = KEYBOARD_LAYOUT.flatMap((row) => row.keys);

export const MAIN_ROWS: KeyRow[] = KEYBOARD_LAYOUT.filter((row) => row.id !== 'function');

/** Every known code, indexed by its exact spelling. */
const KEY_BY_CODE = new Map<string, KeyDef>(ALL_KEYS.map((key) => [key.code, key]));

/** Every known code, indexed case-insensitively — `keya` resolves to `KeyA`. */
const KEY_BY_LOWER_CODE = new Map<string, KeyDef>(
  ALL_KEYS.map((key) => [key.code.toLowerCase(), key]),
);

/**
 * The modifier keys, mapped to the name the readout uses. `ControlLeft` and
 * `ControlRight` share a name but never share a code.
 */
export const MODIFIER_BY_CODE = new Map<string, string>([
  ['ControlLeft', 'Ctrl'],
  ['ControlRight', 'Ctrl'],
  ['ShiftLeft', 'Shift'],
  ['ShiftRight', 'Shift'],
  ['AltLeft', 'Alt'],
  ['AltRight', 'Alt'],
  ['MetaLeft', '⌘'],
  ['MetaRight', '⌘'],
]);

/** True when the code is one of the eight modifier keys. */
export function isModifierCode(code: string): boolean {
  return MODIFIER_BY_CODE.has(code);
}

/**
 * Resolve a code to the key it refers to.
 */
export function resolveCode(code: string): KeyDef | undefined {
  return KEY_BY_CODE.get(code) || KEY_BY_LOWER_CODE.get(code.toLowerCase());
}

/**
 * Resolve a code to the key it refers to, or throw.
 */
export function resolveCodeOrThrow(code: string): KeyDef {
  const key = resolveCode(code);
  if (!key) {
    throw new ToolError(`Unknown key code: ${code}`);
  }
  return key;
}

/**
 * Resolve a code to the key it refers to, or return the code unchanged.
 */
export function resolveCodeSafe(code: string): string {
  return resolveCode(code)?.code || code;
}

/**
 * Resolve a code to the key it refers to, or return the code unchanged.
 * Trims whitespace from the input and resolves known aliases.
 */
export function normalizeCode(code: string): string {
  const trimmed = code.trim().toLowerCase();
  // Resolve aliases first
  const alias = KEY_ALIASES.get(trimmed);
  if (alias) return alias;
  // Single letter codes: 't' -> 'KeyT', 'd' -> 'KeyD', etc.
  if (trimmed.length === 1 && trimmed >= 'a' && trimmed <= 'z') {
    return `Key${trimmed.toUpperCase()}`;
  }
  // Then resolve by code
  return resolveCode(trimmed)?.code || trimmed;
}

/** Normalise a list of codes: trim, resolve and drop duplicates. */
export function normalizeCodes(codes: readonly string[] | undefined): string[] {
  if (!codes) return [];
  return [...new Set(codes.map(normalizeCode))];
}

/**
 * The readable label of a key — 'A', 'Enter', 'Space', 'Ctrl'. Unknown codes
 * are returned unchanged so the readout never goes blank.
 */
export function keyLabel(code: string): string {
  const key = resolveCode(code);
  return key?.label || code;
}

/** The accessible name of a key — 'Key A', 'Enter', 'Space'. */
export function keyAccessibleName(code: string): string {
  const key = resolveCode(code);
  if (!key) return code;
  // Convert KeyA -> Key A, ControlLeft -> Control Left, etc.
  return key.code.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * The character a physical key produces.
 */
export function codeToKey(code: string, shifted = false): string {
  const key = resolveCode(code);
  if (!key) return code;
  return shifted ? key.altLabel || key.label : key.label;
}

/**
 * Render a set of codes as a human combination — 'Ctrl + Shift + T'.
 * Unknown codes are shown as they were written.
 */
export function formatCombination(codes: readonly string[] | undefined): string {
  return normalizeCodes(codes)
    .map((code) => keyLabel(code))
    .join(' + ');
}

/* -------------------------------------------------------------------------- */
/*  Key events                                                                 */
/* -------------------------------------------------------------------------- */

/** The part of a `KeyboardEvent` the tester cares about. */
export interface KeyEventLike {
  code: string;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  type: string;
}

/** A key event, described in plain data. */
export interface EventDescription {
  code: string;
  key: string;
  label: string;
  altLabel?: string;
  isModifier: boolean;
  isModifierLeft: boolean;
  isModifierRight: boolean;
  isShift: boolean;
  isCtrl: boolean;
  isAlt: boolean;
  isMeta: boolean;
  isArrow: boolean;
  isPage: boolean;
  isFunction: boolean;
  isModifier: boolean;
}

/**
 * Describe a key event.
 */
export function describeEvent(event: KeyEventLike): EventDescription {
  const code = normalizeCode(event.code);
  const key = event.key;
  const shifted = event.shiftKey || event.key.length > 1;
  const label = codeToKey(code, shifted);
  const altLabel = codeToKey(code, !shifted);

  const isModifier = isModifierCode(code);
  const isModifierLeft = code.includes('Left');
  const isModifierRight = code.includes('Right');
  const isShift = code.includes('Shift');
  const isCtrl = code.includes('Ctrl');
  const isAlt = code.includes('Alt');
  const isMeta = code.includes('Meta');
  const isArrow = code.includes('Arrow');
  const isPage = code.includes('Page');
  const isFunction = code.startsWith('F');

  return {
    code,
    key,
    label,
    altLabel,
    isModifier,
    isModifierLeft,
    isModifierRight,
    isShift,
    isCtrl,
    isAlt,
    isMeta,
    isPage,
    isFunction,
  };
}

/* -------------------------------------------------------------------------- */
/*  Rollover (ghosting) test                                                   */
/* -------------------------------------------------------------------------- */

/** The verdict of one rollover attempt. */
export interface GhostingResult {
  expected: string[];
  pressed: string[];
  missing: string[];
  downTogether: string[];
  status: 'pass' | 'fail';
  notes: string;
}

/**
 * Decide whether a rollover attempt succeeded.
 */
export function evaluateGhosting(
  expectedCodes: readonly string[] | undefined,
  pressedCodes: readonly string[] | undefined,
): GhostingResult {
  const expected = normalizeCodes(expectedCodes);
  const pressed = normalizeCodes(pressedCodes);

  const expectedSet = new Set(expected);
  const pressedSet = new Set(pressed);

  const missing = expected.filter((code) => !pressedSet.has(code));
  const downTogether = pressed.filter((code) => expectedSet.has(code));

  const status = missing.length === 0 ? 'pass' : 'fail';
  const notes =
    missing.length === 0 ? 'All keys registered simultaneously.' : `Missing: ${missing.join(', ')}`;

  return {
    expected,
    pressed,
    missing,
    downTogether,
    status,
    notes,
  };
}

/** A combination the panel offers as a ready-made rollover challenge. */
export interface GhostingChallenge {
  name: string;
  description: string;
  expected: string[];
}

/**
 * The built-in rollover challenges.
 */
export const GHOSTING_CHALLENGES: GhostingChallenge[] = [
  {
    name: 'Shift + 5',
    description: 'Common password character',
    expected: ['ShiftLeft', 'Digit5'],
  },
  {
    name: 'Ctrl + C',
    description: 'Copy',
    expected: ['ControlLeft', 'KeyC'],
  },
  {
    name: 'Ctrl + V',
    description: 'Paste',
    expected: ['ControlLeft', 'KeyV'],
  },
  {
    name: 'Ctrl + Shift + T',
    description: 'Tab + Shift',
    expected: ['ControlLeft', 'ShiftLeft', 'KeyT'],
  },
  {
    name: 'Alt + Tab',
    description: 'Switch window',
    expected: ['AltLeft', 'Tab'],
  },
  {
    name: 'Ctrl + Alt + Del',
    description: 'Task manager',
    expected: ['ControlLeft', 'AltLeft', 'Delete'],
  },
  {
    name: 'Win + D',
    description: 'Show desktop',
    expected: ['MetaLeft', 'KeyD'],
  },
  {
    name: 'Ctrl + Shift + Esc',
    description: 'Task manager',
    expected: ['ControlLeft', 'ShiftLeft', 'Escape'],
  },
];

/** The alias a user may type for a key. */
const KEY_ALIASES = new Map<string, string>([
  ['ctrl', 'ControlLeft'],
  ['control', 'ControlLeft'],
  ['shift', 'ShiftLeft'],
  ['alt', 'AltLeft'],
  ['meta', 'MetaLeft'],
  ['win', 'MetaLeft'],
  ['cmd', 'MetaLeft'],
  ['command', 'MetaLeft'],
  ['super', 'MetaLeft'],
  ['left', 'ShiftLeft'],
  ['right', 'ShiftRight'],
  ['up', 'ArrowUp'],
  ['down', 'ArrowDown'],
  ['left', 'ArrowLeft'],
  ['right', 'ArrowRight'],
  ['up', 'ArrowUp'],
  ['down', 'ArrowDown'],
  ['pageup', 'PageUp'],
  ['pagedown', 'PageDown'],
  ['pgup', 'PageUp'],
  ['pgdn', 'PageDown'],
  ['enter', 'Enter'],
  ['return', 'Enter'],
  ['space', 'Space'],
  ['backspace', 'Backspace'],
  ['delete', 'Delete'],
  ['del', 'Delete'],
  ['esc', 'Escape'],
  ['escape', 'Escape'],
  ['tab', 'Tab'],
  ['caps', 'CapsLock'],
  ['print', 'PrintScreen'],
  ['scroll', 'ScrollLock'],
  ['pause', 'Pause'],
  ['num', 'NumLock'],
  ['numpad', 'Numpad0'],
  ['numpad/', 'NumpadDivide'],
  ['numpad*', 'NumpadMultiply'],
  ['numpad-', 'NumpadSubtract'],
  ['numpad+', 'NumpadAdd'],
  ['numpad0', 'Numpad0'],
  ['numpad1', 'Numpad1'],
  ['numpad2', 'Numpad2'],
  ['numpad3', 'Numpad3'],
  ['numpad4', 'Numpad4'],
  ['numpad5', 'Numpad5'],
  ['numpad6', 'Numpad6'],
  ['numpad7', 'Numpad7'],
  ['numpad8', 'Numpad8'],
  ['numpad9', 'Numpad9'],
  ['numpad.', 'NumpadDecimal'],
  ['numpad,', 'NumpadComma'],
  ['numpad=', 'NumpadEqual'],
  ['numpadenter', 'NumpadEnter'],
  ['f1', 'F1'],
  ['f2', 'F2'],
  ['f3', 'F3'],
  ['f4', 'F4'],
  ['f5', 'F5'],
  ['f6', 'F6'],
  ['f7', 'F7'],
  ['f8', 'F8'],
  ['f9', 'F9'],
  ['f10', 'F10'],
  ['f11', 'F11'],
  ['f12', 'F12'],
  ['f13', 'F13'],
  ['f14', 'F14'],
  ['f15', 'F15'],
  ['f16', 'F16'],
  ['f17', 'F17'],
  ['f18', 'F18'],
  ['f19', 'F19'],
  ['f20', 'F20'],
  ['f21', 'F21'],
  ['f22', 'F22'],
  ['f23', 'F23'],
  ['f24', 'F24'],
]);

/**
 * Turn one token of a written combination into a code.
 * Returns an empty string when the token is not a key.
 */
export function parseKeyToken(token: string): string {
  const lower = token.toLowerCase().trim();
  const alias = KEY_ALIASES.get(lower);
  if (alias) return alias;
  // Single letter keys: 't' -> 'KeyT', 'd' -> 'KeyD', etc.
  if (lower.length === 1 && lower >= 'a' && lower <= 'z') {
    return `Key${lower.toUpperCase()}`;
  }
  const code = normalizeCode(lower);
  if (code === lower) return '';
  return code;
}

/**
 * Parse a written combination — 'ctrl + shift + t', 'CTRL SHIFT T' — into a
 * list of codes.
 */
export function parseCombination(text: string): string[] {
  const tokens = text.toLowerCase().split(/[\s+]+/);
  const codes: string[] = [];
  for (const token of tokens) {
    const code = parseKeyToken(token);
    if (code) codes.push(code);
  }
  return codes;
}

/** Parse the snapshot the panel produced. Throws a `ToolError` when it cannot. */
export function parseSession(text: string): KeyboardSession {
  try {
    const session = JSON.parse(text);
    if (!session.attempts || !Array.isArray(session.attempts)) {
      throw new Error('No attempts array');
    }
    if (!session.options || typeof session.options !== 'object') {
      throw new Error('No options object');
    }
    return session as KeyboardSession;
  } catch (err) {
    throw new Error(`Failed to parse keyboard tester session: ${err}`);
  }
}


/** Build the rollover report from a recorded session. */
export function buildReport(session: KeyboardSession, options: OptionValues): TextRunResult {
  const historySize = clampInt(options.historySize, 1, 50, 10);
  const includeTimestamps = Boolean(options.includeTimestamps);

  const attempts = session.attempts.slice(0, historySize);

  const rows = attempts.map((a) => {
    const missing = a.missing.length;
    const result = a.status === 'pass' ? 'pass' : 'fail';
    const missingText = missing === 0 ? '—' : missing.toString();
    const downText = a.downTogether.join(', ');

    const when = includeTimestamps ? a.when : '';

    return [a.combination, result, missingText, downText, when];
  });

  const table = rows.map((r) => r.join('\t')).join('\n');

  const headerRow = HEADERS.map((h) => h.padEnd(20))
    .join('')
    .trim();
  const fullTable = `${headerRow}\n${table}`;

  return {
    text: fullTable,
    format: 'text',
    meta: {
      title: 'Keyboard Tester Report',
      description: 'Rollover test results',
    },
  };
}
