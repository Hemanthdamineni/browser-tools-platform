import { describe, expect, it } from 'vitest';
import { buildPayload, modeInputs } from './data-uri-panel';

describe('data-uri panel · buildPayload', () => {
  it('sends the text for the text modes', () => {
    const payload = buildPayload('text-encode', 'hello', [], { mode: 'text-encode' });
    expect(payload.text).toBe('hello');
    expect(payload.files).toEqual([]);
    expect(payload.options.mode).toBe('text-encode');
  });

  it('sends the file for the image-encode mode', () => {
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    const payload = buildPayload('image-encode', '', [file], {});
    expect(payload.files).toHaveLength(1);
    expect(payload.text).toBe('');
    expect(payload.options.mode).toBe('image-encode');
  });

  it('sends both the pasted text and the file for the image-decode mode', () => {
    const file = new File(['data:image/png;base64,AA=='], 'a.txt', { type: 'text/plain' });
    const payload = buildPayload('image-decode', 'data:image/png;base64,AA==', [file], {});
    expect(payload.text).toBe('data:image/png;base64,AA==');
    expect(payload.files).toHaveLength(1);
  });

  it('keeps only the first file', () => {
    const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')];
    expect(buildPayload('image-encode', '', files, {}).files).toHaveLength(1);
  });

  it('always states the mode in the options', () => {
    const payload = buildPayload('text-decode', 'x', [], { mode: 'wrong' });
    expect(payload.options.mode).toBe('text-decode');
  });
});

describe('data-uri panel · modeInputs', () => {
  it('shows the text area for the text modes', () => {
    expect(modeInputs('text-encode')).toEqual({ text: true, file: false });
    expect(modeInputs('text-decode')).toEqual({ text: true, file: false });
  });

  it('shows the file picker for the image modes', () => {
    expect(modeInputs('image-encode')).toEqual({ text: false, file: true });
    expect(modeInputs('image-decode')).toEqual({ text: true, file: true });
  });
});
