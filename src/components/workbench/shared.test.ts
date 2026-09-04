import { describe, it, expect, beforeEach } from 'vitest';
import { renderTextResult } from './shared';

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
