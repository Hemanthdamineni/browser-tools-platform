import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyExampleOptions,
  applyKeyPress,
  BASIC_KEYS,
  EMPTY_MEMORY,
  memoryAdd,
  memoryClear,
  memoryIndicator,
  memoryRecall,
  memoryStore,
  memorySubtract,
  mountCalculatorPanel,
  SCIENTIFIC_KEYS,
  type CalcKey,
} from './calculator-panel';
import { FUNCTIONS } from '@/tools/misc/calculator.core';
import { runToolById } from '@/lib/worker/client';

vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/** Settle the resolved-promise chain in `evaluate` without real waiting. */
const settle = () => vi.advanceTimersByTimeAsync(0);

/** The markup `calculator.astro` renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.calculatorPanel = '';
  root.dataset.toolId = 'calculator';
  root.innerHTML = `
    <div data-example-row>
      <button data-example data-example-entry="2+3*4">Order</button>
      <button data-example data-example-entry="sin(90)" data-example-options='{"angleMode":"degrees","scientific":true}'>Trig</button>
    </div>
    <input data-expression>
    <span data-memory-badge hidden></span>
    <button data-memory-key="mc">MC</button>
    <button data-memory-key="mr">MR</button>
    <button data-memory-key="m+">M+</button>
    <button data-memory-key="m-">M-</button>
    <div data-scientific-row hidden><div data-scientific-keys></div></div>
    <div data-basic-keys></div>
    <button data-eq>Evaluate</button>
    <input type="checkbox" data-scientific>
    <select data-angle-mode><option value="radians" selected>Radians</option><option value="degrees">Degrees</option></select>
    <input type="number" data-precision value="10">
    <div data-error hidden></div>
    <div data-result-wrap hidden><div data-output></div><ul data-notes></ul></div>
  `;
  return root;
}

const findKey = (root: HTMLElement, label: string): HTMLButtonElement =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent === label,
  )!;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('calculator keypad registry', () => {
  it('derives the scientific keys from the core function registry', () => {
    const scientificFns = Object.values(FUNCTIONS).filter((fn) => fn.scientific);
    const inserts = SCIENTIFIC_KEYS.map((k) => k.insert);
    for (const fn of scientificFns) {
      expect(inserts, `missing registry entry for ${fn.insert}`).toContain(fn.insert);
    }
    // Every scientific function becomes exactly one key.
    expect(SCIENTIFIC_KEYS.filter((k) => k.kind === 'fn').length).toBe(scientificFns.length);
  });

  it('exposes keys for every scientific function the evaluator understands', () => {
    const inserts = SCIENTIFIC_KEYS.map((k) => k.insert);
    for (const insert of [
      'sin(',
      'cos(',
      'tan(',
      'log10(',
      'ln(',
      'log2(',
      'sqrt(',
      'cbrt(',
      '^',
      '!',
      'pi',
      'e',
    ]) {
      expect(inserts, `missing ${insert}`).toContain(insert);
    }
  });

  it('has the digits and operators on the basic keypad', () => {
    const inserts = BASIC_KEYS.map((k) => k.insert);
    for (const insert of ['0', '1', '7', '+', '-', '*', '/', '%', '^', '!', '(', ')', '.']) {
      expect(inserts, `missing ${insert}`).toContain(insert);
    }
  });

  it('marks the calculator verbs on the basic keypad', () => {
    expect(BASIC_KEYS.some((k) => k.kind === 'edit')).toBe(true);
    expect(BASIC_KEYS.some((k) => k.kind === 'eq')).toBe(true);
  });
});

describe('calculator key-insert rule', () => {
  it('appends the key insert to the expression', () => {
    const seven = BASIC_KEYS.find((k) => k.insert === '7')!;
    expect(applyKeyPress('', seven)).toBe('7');
    expect(applyKeyPress('12', seven)).toBe('127');
  });

  it('appends an opening parenthesis for a function key', () => {
    const sin = SCIENTIFIC_KEYS.find((k) => k.insert === 'sin(')!;
    expect(applyKeyPress('2+', sin)).toBe('2+sin(');
  });

  it('leaves the expression untouched for edit and equals keys', () => {
    const clear: CalcKey = { label: 'C', insert: '', kind: 'edit' };
    const equals: CalcKey = { label: '=', insert: '', kind: 'eq' };
    expect(applyKeyPress('1+2', clear)).toBe('1+2');
    expect(applyKeyPress('1+2', equals)).toBe('1+2');
  });
});

describe('calculator memory register', () => {
  it('starts empty and reports no indicator', () => {
    expect(EMPTY_MEMORY.value).toBeNull();
    expect(memoryIndicator(EMPTY_MEMORY)).toBe('');
    expect(memoryRecall(EMPTY_MEMORY)).toBe('');
  });

  it('stores a value and recalls it as text', () => {
    expect(memoryIndicator(memoryStore(42))).toBe('M');
    expect(memoryRecall(memoryStore(42))).toBe('42');
    expect(memoryRecall(memoryStore(0.5))).toBe('0.5');
  });

  it('M+ adds to an empty register from zero', () => {
    expect(memoryAdd(EMPTY_MEMORY, 5).value).toBe(5);
    expect(memoryAdd(memoryStore(5), 3).value).toBe(8);
  });

  it('M- subtracts and can go negative', () => {
    expect(memorySubtract(EMPTY_MEMORY, 4).value).toBe(-4);
    expect(memorySubtract(memoryStore(10), 3).value).toBe(7);
  });

  it('MC clears the register', () => {
    expect(memoryClear()).toEqual({ value: null });
  });

  it('refuses to store a non-finite value', () => {
    expect(memoryStore(Number.POSITIVE_INFINITY).value).toBeNull();
    expect(memoryAdd(memoryStore(Number.MAX_VALUE), Number.MAX_VALUE).value).toBeNull();
  });
});

describe('calculator panel mounting', () => {
  it('evaluates the typed expression through the tool', async () => {
    runToolByIdMock.mockResolvedValue({
      output: '14',
      render: 'text',
      notes: ['Parsed expression: 2+3*4'],
    });
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    root.querySelector<HTMLInputElement>('[data-expression]')!.value = '2+3*4';
    root.querySelector<HTMLButtonElement>('[data-eq]')!.click();
    await settle();

    expect(runToolByIdMock).toHaveBeenCalledWith('calculator', {
      text: '2+3*4',
      options: { scientific: false, angleMode: 'radians', precision: 10 },
    });
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>('[data-output] textarea')!.value).toBe('14');
  });

  it('appends a scientific key to the expression', () => {
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    findKey(root, 'sin').click();
    findKey(root, '7').click();
    findKey(root, ')').click();
    expect(root.querySelector<HTMLInputElement>('[data-expression]')!.value).toBe('sin(7)');
  });

  it('clears and backspaces with the edit keys', () => {
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-expression]')!;
    input.value = '123';
    findKey(root, '⌫').click();
    expect(input.value).toBe('12');
    findKey(root, 'C').click();
    expect(input.value).toBe('');
  });

  it('shows the scientific row only when the toggle is on', () => {
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    const row = root.querySelector<HTMLElement>('[data-scientific-row]')!;
    const toggle = root.querySelector<HTMLInputElement>('[data-scientific]')!;
    expect(row.hidden).toBe(true);

    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(row.hidden).toBe(false);

    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(row.hidden).toBe(true);
  });

  it('drives the memory register from the keypad', async () => {
    runToolByIdMock.mockResolvedValue({ output: '42', render: 'text' });
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-expression]')!;
    const badge = root.querySelector<HTMLElement>('[data-memory-badge]')!;
    input.value = '40+2';
    root.querySelector<HTMLButtonElement>('[data-eq]')!.click();
    await settle();

    findKey(root, 'M+').click();
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('M');

    input.value = '';
    findKey(root, 'MR').click();
    expect(input.value).toBe('42');

    findKey(root, 'MC').click();
    expect(badge.hidden).toBe(true);
  });

  it('fills and runs an example chip', async () => {
    runToolByIdMock.mockResolvedValue({ output: '14', render: 'text' });
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    root.querySelector<HTMLButtonElement>('[data-example]')!.click();
    await settle();

    expect(root.querySelector<HTMLInputElement>('[data-expression]')!.value).toBe('2+3*4');
    expect(runToolByIdMock).toHaveBeenCalledWith('calculator', {
      text: '2+3*4',
      options: { scientific: false, angleMode: 'radians', precision: 10 },
    });
  });

  it('applies an example chip\u2019s options before running it', async () => {
    runToolByIdMock.mockResolvedValue({ output: '1', render: 'text' });
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    const chips = root.querySelectorAll<HTMLButtonElement>('[data-example]');
    chips[1]!.click();
    await settle();

    expect(root.querySelector<HTMLSelectElement>('[data-angle-mode]')!.value).toBe('degrees');
    expect(root.querySelector<HTMLElement>('[data-scientific-row]')!.hidden).toBe(false);
    expect(runToolByIdMock).toHaveBeenCalledWith('calculator', {
      text: 'sin(90)',
      options: { scientific: true, angleMode: 'degrees', precision: 10 },
    });
  });

  it('shows a friendly error when the expression is invalid', async () => {
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    const rejection = Object.assign(new Error('The expression is incomplete.'), {
      hint: 'Expected a value.',
    });
    runToolByIdMock.mockRejectedValue(rejection);

    root.querySelector<HTMLInputElement>('[data-expression]')!.value = '2 +';
    root.querySelector<HTMLButtonElement>('[data-eq]')!.click();
    await settle();

    const error = root.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('The expression is incomplete.');
    expect(error.textContent).toContain('Expected a value.');
  });

  it('leaves the result hidden for an empty expression', async () => {
    const root = fixture();
    document.body.append(root);
    mountCalculatorPanel(root);

    root.querySelector<HTMLButtonElement>('[data-eq]')!.click();
    await settle();

    expect(runToolByIdMock).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });
});

describe('applyExampleOptions', () => {
  it('ignores a missing or malformed payload', () => {
    const root = fixture();
    expect(() => applyExampleOptions(root, undefined)).not.toThrow();
    expect(() => applyExampleOptions(root, '{not json')).not.toThrow();
  });

  it('writes only the options it understands', () => {
    const root = fixture();
    applyExampleOptions(
      root,
      JSON.stringify({ angleMode: 'degrees', precision: 4, scientific: true }),
    );
    expect(root.querySelector<HTMLSelectElement>('[data-angle-mode]')!.value).toBe('degrees');
    expect(root.querySelector<HTMLInputElement>('[data-precision]')!.value).toBe('4');
    expect(root.querySelector<HTMLInputElement>('[data-scientific]')!.checked).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-scientific-row]')!.hidden).toBe(false);
  });
});
