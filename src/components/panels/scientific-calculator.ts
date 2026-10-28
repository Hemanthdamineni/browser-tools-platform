/**
 * Scientific Calculator panel mount module.
 *
 * Loaded on demand by `scientific-calculator.astro` so no calculator code ships
 * to pages that don't use it.
 *
 * The panel owns the interaction (keypad, expression field, history) and hands
 * the payload to the tool via `runToolById`, which evaluates using a safe
 * recursive-descent parser (no eval / new Function).
 */
import { runToolById } from '@/lib/worker/client';
import type { TextRunResult, TextRunInput } from '@/lib/types';
import { clearError, renderTextResult, showError, readOptions, applyShowWhen } from '../workbench/shared';
import { escapeHtml } from '@/lib/format';

/** A single history entry. */
interface HistoryEntry {
  expression: string;
  result: string;
  options: Record<string, unknown>;
}

/** Maximum history entries to keep in memory. */
const MAX_HISTORY = 50;

/**
 * Map keypad `data-key` values to the text they should insert.
 * Functions that need parentheses get them added automatically.
 */
const KEY_INSERT_MAP: Record<string, string> = {
  // Constants
  pi: 'pi',
  e: 'e',
  phi: 'phi',
  tau: 'tau',
  sqrt2: 'sqrt2',
  ln2: 'ln2',
  ln10: 'ln10',
  // Trig
  sin: 'sin(',
  cos: 'cos(',
  tan: 'tan(',
  asin: 'asin(',
  acos: 'acos(',
  atan: 'atan(',
  atan2: 'atan2(',
  // Hyperbolic
  sinh: 'sinh(',
  cosh: 'cosh(',
  tanh: 'tanh(',
  asinh: 'asinh(',
  acosh: 'acosh(',
  atanh: 'atanh(',
  deg2rad: 'deg2rad(',
  // Log/Exp
  ln: 'ln(',
  log: 'log(',
  log2: 'log2(',
  log10: 'log10(',
  exp: 'exp(',
  expm1: 'expm1(',
  log1p: 'log1p(',
  // Powers & Roots
  '^': '^',
  sqrt: 'sqrt(',
  cbrt: 'cbrt(',
  pow10: 'pow10(',
  exp10: 'exp10(',
  hypot: 'hypot(',
  '!': '!',
  // Operators
  '/': '/',
  '*': '*',
  '+': '+',
  '-': '-',
  '%': '%',
  // Combinatorics
  nPr: 'nPr(',
  nCr: 'nCr(',
  gcd: 'gcd(',
  lcm: 'lcm(',
  rand: 'random(',
  // Punctuation
  '(': '(',
  ')': ')',
  ',': ',',
  '.': '.',
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
};


/** Mount the scientific calculator panel into a `[data-scientific-calculator]` element. */
export function mountScientificCalculatorPanel(root: HTMLElement): void {
  // --- DOM refs ---
  const exprField = root.querySelector<HTMLTextAreaElement>('[data-expression]')!;
  const keypad = root.querySelector<HTMLElement>('[data-keypad]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-action="run"]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-action="clear"]')!;
  const backspaceBtn = root.querySelector<HTMLButtonElement>('[data-action="backspace"]')!;
  const clearHistoryBtn = root.querySelector<HTMLButtonElement>('[data-action="clear-history"]')!;
  const exampleBtns = root.querySelectorAll<HTMLButtonElement>('[data-example-index]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const historyWrap = root.querySelector<HTMLElement>('[data-history-wrap]')!;
  const historyList = root.querySelector<HTMLElement>('[data-history-list]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = progressWrap.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressText = progressWrap.querySelector<HTMLElement>('[data-progress-text]')!;

  // --- State ---
  let history: HistoryEntry[] = [];
  let abortController: AbortController | null = null;

  // --- Helpers ---
  function setExpression(text: string): void {
    exprField.value = text;
    exprField.focus();
    exprField.setSelectionRange(text.length, text.length);
  }

  function appendToExpression(text: string): void {
    const start = exprField.selectionStart;
    const end = exprField.selectionEnd;
    const current = exprField.value;
    const next = current.slice(0, start) + text + current.slice(end);
    exprField.value = next;
    const pos = start + text.length;
    exprField.setSelectionRange(pos, pos);
    exprField.focus();
  }

  function clearAll(): void {
    setExpression('');
    clearError(errorBox);
    resultWrap.hidden = true;
    resultWrap.innerHTML = '';
    clearBtn.disabled = false;
    runBtn.disabled = false;
    backspaceBtn.disabled = false;
  }

  function addToHistory(entry: HistoryEntry): void {
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();
    renderHistory();
  }

  function renderHistory(): void {
    if (history.length === 0) {
      historyWrap.hidden = true;
      return;
    }
    historyWrap.hidden = false;
    historyList.innerHTML = history
      .map(
        (entry, idx) => `
        <li>
          <button
            type="button"
            data-history-index="${idx}"
            title="${escapeHtml(entry.expression)} = ${escapeHtml(entry.result)}"
            aria-label="Load: ${escapeHtml(entry.expression)}"
          >
            <span class="font-mono">${escapeHtml(entry.expression)}</span>
            <span class="ml-2 text-[rgb(var(--text-muted))] opacity-70">= ${escapeHtml(entry.result)}</span>
          </button>
        </li>
      `
      )
      .join('');
  }

  function showProgress(fraction: number, message?: string): void {
    progressWrap.hidden = false;
    progressBar.style.width = `${Math.round(fraction * 100)}%`;
    progressText.textContent = message ?? 'Evaluating…';
  }

  function hideProgress(): void {
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    progressText.textContent = 'Evaluating…';
  }

  async function evaluate(): Promise<void> {
    const text = exprField.value.trim();
    if (!text) return;

    clearError(errorBox);
    abortController = new AbortController();

    runBtn.disabled = true;
    clearBtn.disabled = true;
    backspaceBtn.disabled = true;
    showProgress(0.1, 'Parsing…');

    try {
      const options = readOptions(root);
      const payload: Record<string, unknown> = { text, options };

      showProgress(0.5, 'Evaluating…');

      const result = await runToolById<TextRunResult>('upgrade-calculator-scientific', payload, {
        signal: abortController.signal,
        onProgress: (frac, msg) => showProgress(0.5 + frac * 0.4, msg),
      });

      hideProgress();

      // Render result
      resultWrap.hidden = false;
      resultWrap.innerHTML = '';
      renderTextResult(resultWrap, result);

      // Add to history
      addToHistory({
        expression: text,
        result: result.output,
        options,
      });

      // Update clear history button visibility
      clearHistoryBtn.hidden = history.length === 0;
    } catch (e) {
      hideProgress();
      if (e instanceof DOMException && e.name === 'AbortError') {
        showError(errorBox, 'Evaluation aborted');
      } else if (e instanceof Error) {
        showError(errorBox, e.message);
      } else {
        showError(errorBox, 'Unknown evaluation error');
      }
    } finally {
      runBtn.disabled = false;
      clearBtn.disabled = false;
      backspaceBtn.disabled = false;
      abortController = null;
    }
  }

  // --- Event listeners ---

  // Keypad buttons
  keypad.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-key]');
    if (!btn) return;
    const key = btn.dataset.key!;
    const insert = KEY_INSERT_MAP[key];
    if (insert) appendToExpression(insert);
  });

  // Run button
  runBtn.addEventListener('click', evaluate);

  // Enter key in expression field (without Shift)
  exprField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      evaluate();
    }
  });

  // Clear button
  clearBtn.addEventListener('click', clearAll);

  // Backspace button
  backspaceBtn.addEventListener('click', () => {
    const start = exprField.selectionStart;
    const end = exprField.selectionEnd;
    const current = exprField.value;
    if (start !== end) {
      // Delete selection
      exprField.value = current.slice(0, start) + current.slice(end);
      exprField.setSelectionRange(start, start);
    } else if (start > 0) {
      // Delete char before cursor
      exprField.value = current.slice(0, start - 1) + current.slice(end);
      exprField.setSelectionRange(start - 1, start - 1);
    }
    exprField.focus();
  });

  // Clear history button
  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    renderHistory();
  });

  // Example buttons
  exampleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.dataset.exampleInput!;
      setExpression(input);
      evaluate();
    });
  });

  // History list (delegated)
  historyList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-history-index]');
    if (!btn) return;
    const idx = Number(btn.dataset.historyIndex!);
    const entry = history[idx];
    if (entry) {
      setExpression(entry.expression);
      evaluate();
    }
  });

  // Options change -> re-apply showWhen
  root.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-opt-key]')) {
      applyShowWhen(root);
    }
  });

  // Initial render
  renderHistory();
  clearHistoryBtn.hidden = true;
}