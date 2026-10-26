import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The panel module imports the worker client; the pure formatters never run it,
// so the mock keeps this test from pulling the whole tool registry.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

import {
  MAX_INPUT_BYTES,
  MAX_INPUT_SECONDS,
  MODEL_CHOICES,
  checkByteCap,
  checkDurationCap,
  cleanSegmentText,
  formatTimestamp,
  mergeOverlappingSegments,
  modelSupportsLanguage,
  mountSpeechToTextPanel,
  resolveModel,
  segmentsToSrt,
  segmentsToTxt,
  segmentsToVtt,
  srtTimestamp,
  timestampParts,
  vttTimestamp,
  type TranscriptSegment,
} from './speech-to-text-panel';

/** Two short segments with known text and timings. */
const SEGMENTS: TranscriptSegment[] = [
  { start: 0, end: 1.5, text: 'Hello there' },
  { start: 1.5, end: 65.25, text: 'How are you today' },
];

describe('formatTimestamp', () => {
  it('formats SRT timestamps as HH:MM:SS,mmm', () => {
    expect(srtTimestamp(0)).toBe('00:00:00,000');
    expect(srtTimestamp(1.5)).toBe('00:00:01,500');
    expect(srtTimestamp(65.25)).toBe('00:01:05,250');
    expect(srtTimestamp(3661.004)).toBe('01:01:01,004');
  });

  it('formats VTT timestamps as HH:MM:SS.mmm', () => {
    expect(vttTimestamp(0)).toBe('00:00:00.000');
    expect(vttTimestamp(1.5)).toBe('00:00:01.500');
    expect(vttTimestamp(65.25)).toBe('00:01:05.250');
  });

  it('rounds to the nearest millisecond and carries into the seconds column', () => {
    expect(formatTimestamp(59.9996, ',')).toBe('00:01:00,000');
    expect(formatTimestamp(0.0009, ',')).toBe('00:00:00,001');
  });

  it('clamps negative and non-finite times to zero', () => {
    expect(srtTimestamp(-4)).toBe('00:00:00,000');
    expect(srtTimestamp(Number.NaN)).toBe('00:00:00,000');
  });
});

describe('timestampParts', () => {
  it('splits hours, minutes, seconds and milliseconds', () => {
    expect(timestampParts(3725.5)).toEqual({ h: 1, m: 2, s: 5, ms: 500 });
  });
});

describe('segmentsToSrt', () => {
  it('writes an indexed SubRip block per segment', () => {
    expect(segmentsToSrt(SEGMENTS)).toBe(
      '1\n' +
        '00:00:00,000 --> 00:00:01,500\n' +
        'Hello there\n' +
        '\n' +
        '2\n' +
        '00:00:01,500 --> 00:01:05,250\n' +
        'How are you today\n' +
        '\n',
    );
  });

  it('returns an empty string for no segments', () => {
    expect(segmentsToSrt([])).toBe('');
  });

  it('trims and collapses whitespace in the text', () => {
    const messy: TranscriptSegment[] = [{ start: 0, end: 1, text: '  hi   there \n' }];
    expect(segmentsToSrt(messy)).toBe('1\n00:00:00,000 --> 00:00:01,000\nhi there\n\n');
  });
});

describe('segmentsToVtt', () => {
  it('writes a WEBVTT header and dot-separated timestamps', () => {
    expect(segmentsToVtt(SEGMENTS)).toBe(
      'WEBVTT\n' +
        '\n' +
        '00:00:00.000 --> 00:00:01.500\n' +
        'Hello there\n' +
        '\n' +
        '00:00:01.500 --> 00:01:05.250\n' +
        'How are you today\n' +
        '\n',
    );
  });

  it('still emits the header when there are no segments', () => {
    expect(segmentsToVtt([])).toBe('WEBVTT\n\n');
  });
});

describe('segmentsToTxt', () => {
  it('writes one recognised line per segment', () => {
    expect(segmentsToTxt(SEGMENTS)).toBe('Hello there\nHow are you today');
  });

  it('returns an empty string for no segments', () => {
    expect(segmentsToTxt([])).toBe('');
  });
});

describe('mergeOverlappingSegments', () => {
  it('folds overlapping segments into one span', () => {
    const merged = mergeOverlappingSegments([
      { start: 0, end: 5, text: 'one' },
      { start: 4, end: 9, text: 'two' },
      { start: 12, end: 14, text: 'three' },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 9, text: 'one two' },
      { start: 12, end: 14, text: 'three' },
    ]);
  });

  it('sorts by start time first', () => {
    const merged = mergeOverlappingSegments([
      { start: 10, end: 12, text: 'second' },
      { start: 0, end: 2, text: 'first' },
    ]);
    expect(merged.map((s) => s.text)).toEqual(['first', 'second']);
  });

  it('drops empty and zero-length segments', () => {
    const merged = mergeOverlappingSegments([
      { start: 0, end: 0, text: 'nothing' },
      { start: 1, end: 2, text: '   ' },
      { start: 3, end: 4, text: 'kept' },
    ]);
    expect(merged).toEqual([{ start: 3, end: 4, text: 'kept' }]);
  });

  it('returns an empty array when nothing survives', () => {
    expect(mergeOverlappingSegments([])).toEqual([]);
  });
});

describe('length caps', () => {
  it('accepts a file at or under the byte cap', () => {
    expect(checkByteCap(0)).toBeNull();
    expect(checkByteCap(MAX_INPUT_BYTES)).toBeNull();
  });

  it('rejects a file over the byte cap with the cap in the message', () => {
    const message = checkByteCap(MAX_INPUT_BYTES + 1);
    expect(message).toMatch(/larger than/);
    expect(message).toMatch(/64 MB/);
  });

  it('rejects an unreadable size', () => {
    expect(checkByteCap(Number.NaN)).toMatch(/no readable size/);
  });

  it('accepts a recording at or under the duration cap', () => {
    expect(checkDurationCap(0)).toBeNull();
    expect(checkDurationCap(MAX_INPUT_SECONDS)).toBeNull();
  });

  it('rejects a recording over the duration cap', () => {
    const message = checkDurationCap(MAX_INPUT_SECONDS + 1);
    expect(message).toMatch(/cap is 10m 0s/);
  });
});

describe('model + language helpers', () => {
  it('maps both choices to their allow-listed Hub ids', () => {
    expect(resolveModel('tiny.en').modelId).toBe(MODEL_CHOICES['tiny.en'].modelId);
    expect(resolveModel('base').modelId).toBe('Xenova/whisper-base');
  });

  it('falls back to the English model for an unknown choice', () => {
    expect(resolveModel('nope').modelId).toBe('Xenova/whisper-tiny.en');
  });

  it('only exposes a language picker for the multilingual model', () => {
    expect(modelSupportsLanguage('tiny.en')).toBe(false);
    expect(modelSupportsLanguage('base')).toBe(true);
  });
});

describe('cleanSegmentText', () => {
  it('trims and collapses internal whitespace', () => {
    expect(cleanSegmentText('  a\n b\t c ')).toBe('a b c');
  });
});

/* -------------------------------------------------------------------------- */
/*  Mounted panel                                                              */
/* -------------------------------------------------------------------------- */

/** The markup the panel reads (the parts `mountSpeechToTextPanel` queries). */
function fixture(): HTMLElement {
  const panel = document.createElement('section');
  panel.dataset.fileWorkbench = '';
  panel.dataset.speechPanel = '';
  panel.dataset.toolId = 'speech-to-text';
  panel.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <button type="button" data-mic-record>Record</button>
    <button type="button" data-mic-stop hidden>Stop</button>
    <span data-mic-indicator hidden><span data-mic-timer>0:00</span></span>
    <div data-options>
      <div data-option-wrap="model">
        <select data-opt-key="model" data-opt-type="select">
          <option value="tiny.en" selected>tiny</option>
          <option value="base">base</option>
        </select>
      </div>
      <div data-option-wrap="language" data-show-when='{"key":"model","value":"base"}'>
        <select data-opt-key="language" data-opt-type="select">
          <option value="auto" selected>auto</option>
          <option value="fr">fr</option>
        </select>
      </div>
    </div>
    <p data-english-note hidden>English only</p>
    <p data-download-hint></p>
    <button type="button" data-example="0" data-example-options='{"model":"base","language":"fr"}'>French</button>
    <button type="button" data-run disabled>Run</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden>
      <pre data-transcript></pre>
      <div data-outputs></div>
      <ul data-notes></ul>
    </div>
  `;
  document.body.append(panel);
  return panel;
}

/** Hand a file to the drop zone the way the file picker does. */
function chooseFile(panel: HTMLElement, file: File): void {
  const input = panel.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('mountSpeechToTextPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the English-only note for the default tiny model and fills the options from an example', () => {
    const panel = fixture();
    mountSpeechToTextPanel(panel);

    const note = panel.querySelector<HTMLElement>('[data-english-note]')!;
    expect(note.hidden).toBe(false); // tiny.en is English-only

    panel.querySelector<HTMLButtonElement>('[data-example]')!.click();

    const model = panel.querySelector<HTMLSelectElement>('[data-opt-key="model"]')!;
    const language = panel.querySelector<HTMLSelectElement>('[data-opt-key="language"]')!;
    expect(model.value).toBe('base');
    expect(language.value).toBe('fr');
    expect(note.hidden).toBe(true); // base supports languages, so the note hides
    // The language field's showWhen wrapper becomes visible for the base model.
    expect(panel.querySelector<HTMLElement>('[data-show-when]')!.hidden).toBe(false);
  });

  it('rejects a file over the byte cap and keeps the run button disabled', () => {
    const panel = fixture();
    mountSpeechToTextPanel(panel);

    const file = new File([new Uint8Array(128)], 'clip.wav', { type: 'audio/wav' });
    // `size` is a prototype getter; shadow it on the instance instead of the prototype.
    Object.defineProperty(file, 'size', { value: MAX_INPUT_BYTES + 1 });
    chooseFile(panel, file);

    const error = panel.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/larger than/);
    expect(panel.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
  });

  it('accepts a valid file and enables the run button', () => {
    const panel = fixture();
    mountSpeechToTextPanel(panel);

    chooseFile(panel, new File([new Uint8Array(128)], 'interview.wav', { type: 'audio/wav' }));

    expect(panel.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(panel.querySelector('[data-file-list]')!.textContent).toMatch(/interview\.wav/);
  });
});
