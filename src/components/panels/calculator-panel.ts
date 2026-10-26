/**
 * Pure helper module for the keys the calculator keypad adds.
 *
 * The expression evaluator itself lives in `src/tools/misc/calculator.core.ts`,
 * which is the single source of truth for every function the calculator knows:
 * its implementation, its keypad label and whether it belongs on the scientific
 * row. This module derives the keypad from that registry, adds the operator and
 * constant keys, and owns the memory register — all as pure functions, so the
 * whole thing is testable without a DOM. Only `mountCalculatorPanel` touches the
 * browser.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { FUNCTIONS } from '@/tools/misc/calculator.core';
import { clearError, renderTextResult, showError } from '../workbench/shared';

/* ------------------------------------------------------------------------ */
/*  Keypad model                                                            */
/* ------------------------------------------------------------------------ */

/** The kind of token a key inserts, used by the pure insert rule. */
export type KeyKind = 'digit' | 'op' | 'fn' | 'const' | 'postfix' | 'paren' | 'dot' | 'eq' | 'edit';

/** A single keypad button. `insert` is what lands in the expression. */
export interface CalcKey {
  label: string;
  insert: string;
  kind: KeyKind;
  /** Secondary label shown under the main one (e.g. 2 on the x² key). */
  alt?: string;
  title?: string;
}

/**
 * The scientific row, derived from the evaluator's own function registry so a
 * function can never be on the keypad without an implementation behind it.
 * The operator/constant keys are added on top because they are grammar or
 * values, not functions.
 */
export const SCIENTIFIC_KEYS: CalcKey[] = [
  ...Object.values(FUNCTIONS)
    .filter((fn) => fn.scientific)
    .map((fn): CalcKey => ({ label: fn.label, insert: fn.insert, kind: 'fn' })),
  { label: 'x²', insert: '^2', kind: 'op', alt: '2' },
  { label: 'xʸ', insert: '^', kind: 'op', alt: '^' },
  { label: '10ˣ', insert: '10^', kind: 'op', alt: '10^' },
  { label: 'x!', insert: '!', kind: 'postfix', alt: '!' },
  { label: 'π', insert: 'pi', kind: 'const', alt: 'pi' },
  { label: 'e', insert: 'e', kind: 'const' },
];

/** The basic keypad that is always visible. */
export const BASIC_KEYS: CalcKey[] = [
  { label: 'C', insert: '', kind: 'edit', title: 'Clear the expression' },
  { label: '⌫', insert: '', kind: 'edit', title: 'Delete the last character' },
  { label: '%', insert: '%', kind: 'op' },
  { label: '÷', insert: '/', kind: 'op', alt: '/' },
  { label: '7', insert: '7', kind: 'digit' },
  { label: '8', insert: '8', kind: 'digit' },
  { label: '9', insert: '9', kind: 'digit' },
  { label: '×', insert: '*', kind: 'op', alt: '*' },
  { label: '4', insert: '4', kind: 'digit' },
  { label: '5', insert: '5', kind: 'digit' },
  { label: '6', insert: '6', kind: 'digit' },
  { label: '−', insert: '-', kind: 'op', alt: '-' },
  { label: '1', insert: '1', kind: 'digit' },
  { label: '2', insert: '2', kind: 'digit' },
  { label: '3', insert: '3', kind: 'digit' },
  { label: '+', insert: '+', kind: 'op' },
  { label: '0', insert: '0', kind: 'digit' },
  { label: '.', insert: '.', kind: 'dot' },
  { label: '(', insert: '(', kind: 'paren' },
  { label: ')', insert: ')', kind: 'paren' },
  { label: 'xʸ', insert: '^', kind: 'op', alt: '^' },
  { label: 'x!', insert: '!', kind: 'postfix', alt: '!' },
  { label: '=', insert: '', kind: 'eq', title: 'Evaluate the expression' },
];

/* ------------------------------------------------------------------------ */
/*  Memory register (pure)                                                  */
/* ------------------------------------------------------------------------ */

export interface MemoryState {
  /** The stored value, or null when the register is empty. */
  value: number | null;
}

export const EMPTY_MEMORY: MemoryState = { value: null };

export function memoryClear(): MemoryState {
  return { value: null };
}

export function memoryStore(v: number): MemoryState {
  return { value: Number.isFinite(v) ? v : null };
}

export function memoryAdd(mem: MemoryState, v: number): MemoryState {
  const current = mem.value ?? 0;
  return { value: Number.isFinite(current + v) ? current + v : null };
}

export function memorySubtract(mem: MemoryState, v: number): MemoryState {
  const current = mem.value ?? 0;
  return { value: Number.isFinite(current - v) ? current - v : null };
}

/** The exact text `MR` should drop into the expression, or '' when empty. */
export function memoryRecall(mem: MemoryState): string {
  return mem.value === null ? '' : String(mem.value);
}

/** Short label shown next to MR ("" for empty, "M" with a value). */
export function memoryIndicator(mem: MemoryState): string {
  return mem.value === null ? '' : 'M';
}

/* ------------------------------------------------------------------------ */
/*  Pure key-insert rule                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Apply a keypress to the current expression and return the new one.
 * `edit` and `eq` keys are handled by the DOM wiring (they need the input
 * element or the run call), so they are filtered out here.
 */
export function applyKeyPress(expr: string, key: CalcKey): string {
  if (key.kind === 'edit' || key.kind === 'eq') return expr;
  return expr + key.insert;
}

/* ------------------------------------------------------------------------ */
/*  DOM wiring                                                              */
/* ------------------------------------------------------------------------ */

function readPrecision(root: HTMLElement): number {
  const raw = Number(root.querySelector<HTMLInputElement>('[data-precision]')?.value ?? 10);
  return Math.max(0, Math.min(15, Math.floor(raw || 10)));
}

function currentOptions(root: HTMLElement): OptionValues {
  return {
    scientific: root.querySelector<HTMLInputElement>('[data-scientific]')?.checked ?? false,
    angleMode: root.querySelector<HTMLSelectElement>('[data-angle-mode]')?.value ?? 'radians',
    precision: readPrecision(root),
  };
}

function buildKeypad(host: HTMLElement, keys: CalcKey[], onKey: (k: CalcKey) => void): void {
  host.innerHTML = '';
  for (const key of keys) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-1.5 ' +
      'text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
      'focus-visible:outline-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-subtle))]';
    btn.dataset.key = key.kind;
    btn.dataset.insert = key.insert;
    if (key.title) btn.title = key.title;
    const label = document.createElement('span');
    label.textContent = key.label;
    btn.append(label);
    if (key.alt) {
      const alt = document.createElement('span');
      alt.className = 'text-[10px] leading-none text-[rgb(var(--text-muted))]';
      alt.textContent = key.alt;
      btn.append(alt);
    }
    btn.addEventListener('click', () => onKey(key));
    host.append(btn);
  }
}

function syncScientificRow(root: HTMLElement, enabled: boolean): void {
  const row = root.querySelector<HTMLElement>('[data-scientific-row]');
  if (row) row.hidden = !enabled;
}

/** Fill the panel's own controls from an example's `options` payload. */
export function applyExampleOptions(panel: HTMLElement, payload: string | undefined): void {
  if (!payload) return;
  let options: OptionValues;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return;
    // Validated as a non-null object above; the example payload is authored in
    // this repo's own meta files, never user input.
    options = parsed as OptionValues;
  } catch {
    return;
  }
  const angle = panel.querySelector<HTMLSelectElement>('[data-angle-mode]');
  if (angle && typeof options.angleMode === 'string') angle.value = options.angleMode;
  const precision = panel.querySelector<HTMLInputElement>('[data-precision]');
  if (precision && typeof options.precision === 'number')
    precision.value = String(options.precision);
  const scientific = panel.querySelector<HTMLInputElement>('[data-scientific]');
  if (scientific && typeof options.scientific === 'boolean') {
    scientific.checked = options.scientific;
    syncScientificRow(panel, scientific.checked);
  }
}

/**
 * Mount the calculator panel into a `[data-calculator-panel]` element. The
 * heavy import is deferred: `calculator.astro` only pulls this module in when
 * the page is actually the calculator.
 */
export function mountCalculatorPanel(panel: HTMLElement): void {
  const toolId = panel.dataset.toolId || 'calculator';

  const input = panel.querySelector<HTMLInputElement>('[data-expression]')!;
  const basicHost = panel.querySelector<HTMLElement>('[data-basic-keys]')!;
  const scientificHost = panel.querySelector<HTMLElement>('[data-scientific-keys]')!;
  const eqBtn = panel.querySelector<HTMLButtonElement>('[data-eq]')!;
  const scientificToggle = panel.querySelector<HTMLInputElement>('[data-scientific]')!;
  const exampleRow = panel.querySelector<HTMLElement>('[data-example-row]')!;
  const memBadge = panel.querySelector<HTMLElement>('[data-memory-badge]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-result-wrap]')!;
  const resultHost = panel.querySelector<HTMLElement>('[data-output]')!;
  const notesHost = panel.querySelector<HTMLUListElement>('[data-notes]')!;

  if (
    !input ||
    !basicHost ||
    !scientificHost ||
    !eqBtn ||
    !scientificToggle ||
    !exampleRow ||
    !memBadge ||
    !errorBox ||
    !resultWrap ||
    !resultHost ||
    !notesHost
  ) {
    return;
  }

  let memory: MemoryState = EMPTY_MEMORY;
  let lastResult: number | null = null;
  let generation = 0;

  function renderMemory(): void {
    memBadge.textContent = memoryIndicator(memory);
    memBadge.hidden = memory.value === null;
  }

  function evaluate(text: string): Promise<void> {
    const gen = ++generation;
    clearError(errorBox);
    resultWrap.hidden = true;
    if (!text.trim()) return Promise.resolve();
    return runToolById<TextRunResult>(toolId, { text, options: currentOptions(panel) })
      .then((result) => {
        if (gen !== generation) return;
        resultWrap.hidden = false;
        renderTextResult(resultHost, result);
        notesHost.textContent = '';
        for (const note of result.notes ?? []) {
          const li = document.createElement('li');
          li.textContent = note;
          notesHost.append(li);
        }
        const parsed = Number(result.output);
        if (result.output && Number.isFinite(parsed)) lastResult = parsed;
      })
      .catch((error: unknown) => {
        if (gen !== generation) return;
        const message = error instanceof Error ? error.message : String(error);
        const hint =
          typeof error === 'object' &&
          error !== null &&
          'hint' in error &&
          typeof error.hint === 'string'
            ? error.hint
            : undefined;
        showError(errorBox, message, hint);
      });
  }

  const onKey = (key: CalcKey): void => {
    clearError(errorBox);
    if (key.kind === 'edit') {
      if (key.label === 'C') input.value = '';
      else input.value = input.value.slice(0, -1);
      input.focus();
      return;
    }
    if (key.kind === 'eq') {
      void evaluate(input.value);
      return;
    }
    input.value = applyKeyPress(input.value, key);
    input.focus();
  };

  buildKeypad(basicHost, BASIC_KEYS, onKey);
  buildKeypad(scientificHost, SCIENTIFIC_KEYS, onKey);

  scientificToggle.addEventListener('change', () => {
    syncScientificRow(panel, scientificToggle.checked);
  });
  syncScientificRow(panel, scientificToggle.checked);

  eqBtn.addEventListener('click', () => {
    void evaluate(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void evaluate(input.value);
    }
  });

  // Memory row: MR inserts the stored value; M+ / M- fold the current result
  // into memory; MC clears it.
  panel.querySelectorAll<HTMLButtonElement>('[data-memory-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switch (btn.dataset.memoryKey) {
        case 'mc':
          memory = memoryClear();
          break;
        case 'mr':
          input.value += memoryRecall(memory);
          input.focus();
          break;
        case 'm+':
          if (lastResult !== null) memory = memoryAdd(memory, lastResult);
          break;
        case 'm-':
          if (lastResult !== null) memory = memorySubtract(memory, lastResult);
          break;
      }
      renderMemory();
    });
  });

  // Example chips fill the input (and any options they carry) and evaluate,
  // matching the text workbench.
  exampleRow.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((example) => {
    example.addEventListener('click', () => {
      applyExampleOptions(panel, example.dataset.exampleOptions);
      input.value = example.dataset.exampleEntry ?? '';
      void evaluate(input.value);
    });
  });

  renderMemory();
}
