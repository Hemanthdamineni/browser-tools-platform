/**
 * Pure keyboard logic for the keyboard tester.
 *
 * Nothing in this file touches the DOM: the on-screen layout, the description
 * of a key event and the rollover (ghosting) verdict are all plain data, so
 * they can be unit-tested without a browser. The panel module owns the
 * listeners and the DOM; this module owns the rules.
 */
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  The on-screen layout                                                       */
/* -------------------------------------------------------------------------- */

/** One key on the on-screen layout. */
export interface KeyDef {
  /** `KeyboardEvent.code` — the physical position of the key. */
  code: string;
  /** The text drawn on the keycap. */
  label: string;
  /**
   * The accessible name. It contains `label`, so the visible text stays part
   * of the announced name (WCAG 2.5.3, label in name). Defaults to `label`.
   */
  name?: string;
  /** The key value the browser reports for this key, e.g. 'a' or 'Enter'. */
  base?: string;
  /** The character the key produces while Shift is held. */
  shifted?: string;
  /** Width in key units — 1u is one letter key. */
  width: number;
}

/** A horizontal run of keys. */
export interface KeyRow {
  /** Stable identifier, e.g. 'number'. */
  id: string;
  /** The keys, left to right. */
  keys: KeyDef[];
}

/** The letter keys of a row, in QWERTY order. */
function letterKeys(letters: string): KeyDef[] {
  return [...letters].map((ch) => ({
    code: `Key${ch}`,
    label: ch,
    name: `Key ${ch}`,
    base: ch.toLowerCase(),
    shifted: ch,
    width: 1,
  }));
}

/** The number keys, with the US layout's shifted symbols. */
function digitKeys(): KeyDef[] {
  const shifted = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => ({
    code: `Digit${n}`,
    label: String(n),
    name: `Key ${n}`,
    base: String(n),
    shifted: shifted[i] ?? '',
    width: 1,
  }));
}

/**
 * The US-QWERTY layout the panel draws. Every row of the main block is 15 key
 * units wide, exactly like a 60 %-size ANSI board.
 */
export const KEYBOARD_LAYOUT: KeyRow[] = [
  {
    id: 'function',
    keys: [
      { code: 'Escape', label: 'Esc', name: 'Escape', base: 'Escape', width: 1 },
      ...Array.from({ length: 12 }, (_, i) => ({
        code: `F${i + 1}`,
        label: `F${i + 1}`,
        base: `F${i + 1}`,
        width: 1,
      })),
    ],
  },
  {
    id: 'number',
    keys: [
      { code: 'Backquote', label: '`', base: '`', shifted: '~', width: 1 },
      ...digitKeys(),
      { code: 'Minus', label: '-', base: '-', shifted: '_', width: 1 },
      { code: 'Equal', label: '=', base: '=', shifted: '+', width: 1 },
      { code: 'Backspace', label: 'Backspace', base: 'Backspace', width: 2 },
    ],
  },
  {
    id: 'qwerty',
    keys: [
      { code: 'Tab', label: 'Tab', base: 'Tab', width: 1.5 },
      ...letterKeys('QWERTYUIOP'),
      { code: 'BracketLeft', label: '[', base: '[', shifted: '{', width: 1 },
      { code: 'BracketRight', label: ']', base: ']', shifted: '}', width: 1 },
      { code: 'Backslash', label: '\\', base: '\\', shifted: '|', width: 1.5 },
    ],
  },
  {
    id: 'asdf',
    keys: [
      { code: 'CapsLock', label: 'Caps', name: 'Caps Lock', base: 'CapsLock', width: 1.75 },
      ...letterKeys('ASDFGHJKL'),
      { code: 'Semicolon', label: ';', base: ';', shifted: ':', width: 1 },
      { code: 'Quote', label: "'", base: "'", shifted: '"', width: 1 },
      { code: 'Enter', label: 'Enter', base: 'Enter', width: 2.25 },
    ],
  },
  {
    id: 'zxcv',
    keys: [
      { code: 'ShiftLeft', label: 'Shift', name: 'Left Shift', base: 'Shift', width: 2.25 },
      ...letterKeys('ZXCVBNM'),
      { code: 'Comma', label: ',', base: ',', shifted: '<', width: 1 },
      { code: 'Period', label: '.', base: '.', shifted: '>', width: 1 },
      { code: 'Slash', label: '/', base: '/', shifted: '?', width: 1 },
      { code: 'ShiftRight', label: 'Shift', name: 'Right Shift', base: 'Shift', width: 2.75 },
    ],
  },
  {
    id: 'bottom',
    keys: [
      { code: 'ControlLeft', label: 'Ctrl', name: 'Left Ctrl', base: 'Control', width: 1.25 },
      { code: 'MetaLeft', label: 'Meta', name: 'Left Meta', base: 'Meta', width: 1.25 },
      { code: 'AltLeft', label: 'Alt', name: 'Left Alt', base: 'Alt', width: 1.25 },
      { code: 'Space', label: 'Space', base: ' ', width: 6.25 },
      { code: 'AltRight', label: 'Alt', name: 'Right Alt', base: 'Alt', width: 1.25 },
      { code: 'MetaRight', label: 'Meta', name: 'Right Meta', base: 'Meta', width: 1.25 },
      { code: 'ContextMenu', label: 'Menu', base: 'ContextMenu', width: 1.25 },
      { code: 'ControlRight', label: 'Ctrl', name: 'Right Ctrl', base: 'Control', width: 1.25 },
    ],
  },
];

/** Every key of the layout, flattened. */
export const ALL_KEYS: KeyDef[] = KEYBOARD_LAYOUT.flatMap((row) => row.keys);

/** The main block of the keyboard — everything except the function row. */
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
  ['MetaLeft', 'Meta'],
  ['MetaRight', 'Meta'],
]);

/** True when the code is one of the eight modifier keys. */
export function isModifierCode(code: string): boolean {
  return MODIFIER_BY_CODE.has(code);
}

/**
 * Resolve a code to the key it refers to.
 *
 * The lookup is forgiving: surrounding whitespace is ignored and the spelling
 * is matched case-insensitively, so ` keya ` finds `KeyA`.
 */
export function normalizeCode(code: string): string {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return '';
  const exact = KEY_BY_CODE.get(trimmed);
  if (exact) return exact.code;
  return KEY_BY_LOWER_CODE.get(trimmed.toLowerCase())?.code ?? trimmed;
}

/** Normalise a list of codes: trim, resolve and drop duplicates. */
export function normalizeCodes(codes: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of codes ?? []) {
    const code = normalizeCode(String(raw ?? ''));
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * The readable label of a key — 'A', 'Enter', 'Space', 'Ctrl'. Unknown codes
 * are returned unchanged so the readout never goes blank.
 */
export function keyLabel(code: string): string {
  const def = KEY_BY_CODE.get(code);
  if (def) return def.label;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return code;
}

/** The accessible name of a key — 'Key A', 'Enter', 'Space'. */
export function keyAccessibleName(code: string): string {
  const def = KEY_BY_CODE.get(code);
  if (!def) return keyLabel(code);
  return def.name ?? def.label;
}

/**
 * The character a physical key produces.
 *
 * With `shifted` the US layout's shifted symbol is returned ('!' for
 * `Digit1`). Modifier keys return their key value ('Control', 'Shift', 'Alt',
 * 'Meta') and named keys return their name ('Enter', 'Tab'). A code that is
 * not part of the layout returns an empty string.
 */
export function codeToKey(code: string, shifted = false): string {
  const resolved = normalizeCode(code);
  const def = KEY_BY_CODE.get(resolved);
  if (def) {
    if (shifted && def.shifted !== undefined) return def.shifted;
    return def.base ?? def.label;
  }
  const genericKey = /^Key([A-Z])$/.exec(resolved);
  if (genericKey?.[1]) return genericKey[1].toLowerCase();
  const genericDigit = /^Digit(\d)$/.exec(resolved);
  if (genericDigit?.[1]) return genericDigit[1];
  return '';
}

/**
 * Render a set of codes as a human combination — 'Ctrl + Shift + T'.
 * Unknown codes are shown as they were written.
 */
export function formatCombination(codes: readonly string[] | undefined): string {
  return normalizeCodes(codes).map((code) => keyLabel(code)).join(' + ');
}

/* -------------------------------------------------------------------------- */
/*  Key events                                                                 */
/* -------------------------------------------------------------------------- */

/** The part of a `KeyboardEvent` the tester cares about. */
export interface KeyEventLike {
  key?: string;
  code?: string;
  repeat?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  type?: string;
}

/** A key event, described in plain data. */
export interface EventDescription {
  /** 'keydown' or 'keyup'. */
  type: 'keydown' | 'keyup';
  /** The `key` the browser reported, unchanged. */
  key: string;
  /** The `code` the browser reported, unchanged. */
  code: string;
  /** The character this physical key produces on a US layout. */
  character: string;
  /** The key plus the modifiers that were held, e.g. 'Ctrl + Shift + T'. */
  combo: string;
  /** True when the browser repeated the event because the key is held down. */
  repeat: boolean;
  /** The modifiers that were held, in a stable order. */
  modifiers: string[];
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  /** True when the key is one of the modifier keys. */
  isModifier: boolean;
  /** The readable label of the key, e.g. 'A', 'Enter', 'Space'. */
  label: string;
  /** True when the code is not part of the known layout. */
  unknown: boolean;
}

/**
 * Describe a key event.
 *
 * The raw `key` and `code` are passed through untouched — that is the whole
 * point of the readout — while `character` shows what the *physical* key
 * produces on a US layout. A Cyrillic or CJK layout therefore shows the same
 * `code` with a different `key`, which is exactly what makes a layout
 * mismatch visible.
 */
export function describeEvent(event: KeyEventLike): EventDescription {
  const rawCode = (event.code ?? '').trim();
  const code = normalizeCode(rawCode);
  const key = event.key ?? '';
  const shift = Boolean(event.shiftKey);
  const ctrl = Boolean(event.ctrlKey);
  const alt = Boolean(event.altKey);
  const meta = Boolean(event.metaKey);

  const modifiers: string[] = [];
  if (ctrl) modifiers.push('Ctrl');
  if (shift) modifiers.push('Shift');
  if (alt) modifiers.push('Alt');
  if (meta) modifiers.push('Meta');

  const own = MODIFIER_BY_CODE.get(code);
  // The key's own modifier is not repeated in the combination: pressing the
  // left Ctrl key reports Ctrl as held, but the combination is just 'Ctrl'.
  const comboModifiers = own ? modifiers.filter((name) => name !== own) : modifiers;

  const character = codeToKey(code, shift);
  // The combination names the character the operating system actually
  // reported, so a non-US layout shows its own letters (Ctrl + ф, not
  // Ctrl + f). Named keys fall back to their label.
  const printable = key.length === 1 && key !== ' ';
  const tail = own ?? (printable ? key : keyLabel(code) || key);
  const combo = [...comboModifiers, tail].filter(Boolean).join(' + ');

  return {
    type: event.type === 'keyup' ? 'keyup' : 'keydown',
    key,
    code: rawCode,
    character,
    combo,
    repeat: Boolean(event.repeat),
    modifiers,
    shift,
    ctrl,
    alt,
    meta,
    isModifier: Boolean(own),
    label: keyLabel(code),
    unknown: rawCode !== '' && !KEY_BY_CODE.has(rawCode),
  };
}

/* -------------------------------------------------------------------------- */
/*  Rollover (ghosting) test                                                   */
/* -------------------------------------------------------------------------- */

/** The verdict of one rollover attempt. */
export interface GhostingResult {
  /** True when every expected key was down at the same time. */
  pass: boolean;
  /** The keys the test asked for. */
  expected: string[];
  /** The keys that were down at the same time. */
  pressed: string[];
  /** The expected keys that never came down together with the others. */
  missing: string[];
  /** Keys that were down but are not part of the combination. */
  extra: string[];
}

/**
 * Decide whether a rollover attempt succeeded.
 *
 * `expectedCodes` is the combination the user was asked to press and
 * `pressedCodes` are the keys that were down simultaneously at the best
 * moment of the attempt. The attempt passes only when every expected key was
 * part of that simultaneous set.
 */
export function evaluateGhosting(
  expectedCodes: readonly string[] | undefined,
  pressedCodes: readonly string[] | undefined,
): GhostingResult {
  const expected = normalizeCodes(expectedCodes);
  if (!expected.length) {
    throw new ToolError(
      'Pick at least one key to test.',
      'A rollover test needs a combination of keys, for example Ctrl + Alt + M.',
    );
  }
  const pressed = normalizeCodes(pressedCodes);
  const pressedSet = new Set(pressed);
  const missing = expected.filter((code) => !pressedSet.has(code));
  const extra = pressed.filter((code) => !expected.includes(code));
  return { pass: missing.length === 0, expected, pressed, missing, extra };
}

/** A combination the panel offers as a ready-made rollover challenge. */
export interface GhostingChallenge {
  /** Stable id used by the panel's select. */
  id: string;
  /** The keys that have to be down at the same time. */
  codes: string[];
}

/**
 * The built-in rollover challenges.
 *
 * None of them uses a combination a browser reserves (Ctrl+T, Ctrl+W,
 * Ctrl+Shift+N …), so pressing them cannot navigate away from the page.
 */
export const GHOSTING_CHALLENGES: GhostingChallenge[] = [
  { id: 'ctrl-alt-m', codes: ['ControlLeft', 'AltLeft', 'KeyM'] },
  { id: 'ctrl-alt-shift-k', codes: ['ControlLeft', 'AltLeft', 'ShiftLeft', 'KeyK'] },
  { id: 'shift-asd', codes: ['ShiftLeft', 'KeyA', 'KeyS', 'KeyD'] },
];

/** The alias a user may type for a key. */
const KEY_ALIASES = new Map<string, string>([
  ['ctrl', 'ControlLeft'],
  ['control', 'ControlLeft'],
  ['lctrl', 'ControlLeft'],
  ['rctrl', 'ControlRight'],
  ['shift', 'ShiftLeft'],
  ['lshift', 'ShiftLeft'],
  ['rshift', 'ShiftRight'],
  ['alt', 'AltLeft'],
  ['lalt', 'AltLeft'],
  ['ralt', 'AltRight'],
  ['meta', 'MetaLeft'],
  ['lmeta', 'MetaLeft'],
  ['rmeta', 'MetaRight'],
  ['cmd', 'MetaLeft'],
  ['command', 'MetaLeft'],
  ['super', 'MetaLeft'],
  ['win', 'MetaLeft'],
  ['esc', 'Escape'],
  ['escape', 'Escape'],
  ['enter', 'Enter'],
  ['return', 'Enter'],
  ['space', 'Space'],
  ['spacebar', 'Space'],
  ['tab', 'Tab'],
  ['backspace', 'Backspace'],
  ['del', 'Delete'],
  ['delete', 'Delete'],
  ['caps', 'CapsLock'],
  ['capslock', 'CapsLock'],
]);

/**
 * Turn one token of a written combination into a code.
 * Returns an empty string when the token is not a key.
 */
export function parseKeyToken(token: string): string {
  const raw = (token ?? '').trim().toLowerCase();
  if (!raw) return '';
  const alias = KEY_ALIASES.get(raw);
  if (alias) return alias;
  if (/^[a-z]$/.test(raw)) return `Key${raw.toUpperCase()}`;
  if (/^[0-9]$/.test(raw)) return `Digit${raw}`;
  const fn = /^f([1-9]|1[0-2])$/.exec(raw);
  if (fn?.[1]) return `F${fn[1]}`;
  return '';
}

/**
 * Parse a written combination — 'ctrl + shift + t', 'CTRL SHIFT T' — into a
 * list of codes.
 *
 * The parse is forgiving about case and whitespace but strict about unknown
 * keys: a typo is reported instead of being silently dropped.
 */
export function parseCombination(text: string): string[] {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError('Type a combination to test.', 'For example: ctrl + shift + t');
  }
  const tokens = raw.split(/[+\s,]+/).filter(Boolean);
  const codes: string[] = [];
  for (const token of tokens) {
    const code = parseKeyToken(token);
    if (!code) {
      throw new ToolError(
        `"${token}" is not a key I recognise.`,
        'Use a letter, a number or a modifier such as ctrl, shift, alt or meta.',
      );
    }
    if (!codes.includes(code)) codes.push(code);
  }
  if (!codes.length) {
    throw new ToolError('Type a combination to test.', 'For example: ctrl + shift + t');
  }
  return codes;
}
