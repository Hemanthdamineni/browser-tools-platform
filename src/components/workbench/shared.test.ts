import { describe, it, expect, beforeEach } from 'vitest';
import { renderTextResult, applyShowWhen, setOptions, revealResult } from './shared';

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('renderTextResult', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = host();
  });

  it('renders text into a read-only textarea by default', () => {
    renderTextResult(el, { output: 'hello' });
    const ta = el.querySelector('textarea');
    expect(ta).not.toBeNull();
    expect(ta!.value).toBe('hello');
    expect(ta!.readOnly).toBe(true);
  });

  it('renders code with a language chip', () => {
    renderTextResult(el, { output: '{"a":1}', render: 'code', language: 'json' });
    expect(el.querySelector('textarea')!.value).toBe('{"a":1}');
    const chip = el.querySelector('span.chip');
    expect(chip?.textContent).toBe('json');
  });

  it('renders image via img.src (not innerHTML)', () => {
    const url = 'data:image/svg+xml;base64,PHN2Zy8+';
    renderTextResult(el, { output: url, render: 'image' });
    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toBe(url);
  });

  it('renders audio via audio.src plus a download link when filename is set', () => {
    const url = 'data:audio/wav;base64,UklGRg==';
    renderTextResult(el, { output: url, render: 'audio', filename: 'tone.wav' });
    const audio = el.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio!.src).toBe(url);
    expect(audio!.controls).toBe(true);
    const a = el.querySelector('a');
    expect(a?.getAttribute('download')).toBe('tone.wav');
    expect(a?.getAttribute('href')).toBe(url);
  });

  it('renders audio without a download link when filename is omitted', () => {
    renderTextResult(el, { output: 'blob:audio', render: 'audio' });
    expect(el.querySelector('audio')).not.toBeNull();
    expect(el.querySelector('a')).toBeNull();
  });

  it('renders colors as clickable swatches', () => {
    renderTextResult(el, { output: JSON.stringify(['#ff0000', '#00ff00']), render: 'colors' });
    const swatches = el.querySelectorAll('button');
    expect(swatches.length).toBe(2);
    expect((swatches[0] as HTMLElement).textContent).toBe('#ff0000');
  });

  it('renders table JSON as an HTML table with string cells', () => {
    const data = { headers: ['a', 'b'], rows: [['1', '2']] };
    renderTextResult(el, { output: JSON.stringify(data), render: 'table' });
    expect(el.querySelector('table')).not.toBeNull();
    expect(el.querySelectorAll('th').length).toBe(2);
    expect(el.querySelector('td')?.textContent).toBe('1');
  });

  it('renders a diff with colourised spans', () => {
    renderTextResult(el, { output: '@@ -1 +1 @@\n-old\n+new', render: 'diff' });
    expect(el.querySelector('pre')?.textContent).toContain('+new');
    expect(el.querySelectorAll('span').length).toBe(3);
  });

  it('escapes HTML in output (never parsed as HTML)', () => {
    renderTextResult(el, { output: '<img src=x onerror=alert(1)>', render: 'text' });
    const ta = el.querySelector('textarea')!;
    expect(ta.value).toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
  });

  it('replaces previous content on each render (report-only reuse)', () => {
    // Simulate the FileWorkbench report container being re-rendered per run.
    renderTextResult(el, { output: 'first', render: 'text' });
    renderTextResult(el, {
      output: JSON.stringify({ headers: ['k'], rows: [['v']] }),
      render: 'table',
    });
    expect(el.querySelectorAll('textarea').length).toBe(0);
    expect(el.querySelector('table')).not.toBeNull();
  });
});

describe('setOptions', () => {
  /** A minimal options form: boolean, number/range, select and text. */
  function form(): HTMLElement {
    const root = host();
    root.innerHTML = `
      <input data-opt-key="flag" data-opt-type="boolean" type="checkbox" />
      <input data-opt-key="size" data-opt-type="number" type="range" value="1" />
      <output data-range-out="size">1</output>
      <select data-opt-key="mode" data-opt-type="select">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <input data-opt-key="label" data-opt-type="text" type="text" />`;
    return root;
  }

  it('writes checkbox, select, text and range values', () => {
    const root = form();
    setOptions(root, { flag: true, size: 5, mode: 'b', label: 'hi' });
    expect((root.querySelector('[data-opt-key="flag"]') as HTMLInputElement).checked).toBe(true);
    expect((root.querySelector('[data-opt-key="size"]') as HTMLInputElement).value).toBe('5');
    expect((root.querySelector('[data-opt-key="mode"]') as HTMLSelectElement).value).toBe('b');
    expect((root.querySelector('[data-opt-key="label"]') as HTMLInputElement).value).toBe('hi');
  });

  it('keeps the range <output> in sync', () => {
    const root = form();
    setOptions(root, { size: 9 });
    expect(root.querySelector('[data-range-out="size"]')!.textContent).toBe('9');
  });

  it('ignores unknown keys and values not present in a select', () => {
    const root = form();
    setOptions(root, { nope: 'x', mode: 'zzz' });
    expect((root.querySelector('[data-opt-key="mode"]') as HTMLSelectElement).value).toBe('a');
  });
});

describe('applyShowWhen', () => {
  function root(): HTMLElement {
    const el = host();
    el.innerHTML = `
      <select data-opt-key="mode" data-opt-type="select">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <div data-show-when='{"key":"mode","value":"b"}' hidden>B only</div>`;
    return el;
  }

  it('reveals a dependent field when its condition is met', () => {
    const el = root();
    (el.querySelector('[data-opt-key="mode"]') as HTMLSelectElement).value = 'b';
    applyShowWhen(el);
    expect((el.querySelector('[data-show-when]') as HTMLElement).hidden).toBe(false);
  });

  it('hides a dependent field again when the condition no longer holds', () => {
    const el = root();
    (el.querySelector('[data-opt-key="mode"]') as HTMLSelectElement).value = 'b';
    applyShowWhen(el);
    (el.querySelector('[data-opt-key="mode"]') as HTMLSelectElement).value = 'a';
    applyShowWhen(el);
    expect((el.querySelector('[data-show-when]') as HTMLElement).hidden).toBe(true);
  });

  it('ignores a malformed condition', () => {
    const el = host();
    el.innerHTML = `<div data-show-when="not json"></div>`;
    expect(() => applyShowWhen(el)).not.toThrow();
  });
});

describe('revealResult', () => {
  it('adds the reveal class (and is repeatable)', () => {
    const el = host();
    revealResult(el);
    expect(el.classList.contains('tb-reveal')).toBe(true);
    revealResult(el);
    expect(el.classList.contains('tb-reveal')).toBe(true);
  });
});
