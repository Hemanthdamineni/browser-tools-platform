import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  MAX_TEXT_LENGTH,
  buildUtteranceConfig,
  clampPitch,
  clampRate,
  clampVolume,
  findVoice,
  groupVoices,
  guardTextLength,
  languageLabel,
  mountTextToSpeechPanel,
  normalizeSettings,
  planToResult,
  type VoiceLike,
} from './text-to-speech-panel';

/* -------------------------------------------------------------------------- */
/*  Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

const voice = (name: string, lang: string, overrides: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  default: false,
  localService: true,
  voiceURI: `${name}-uri`,
  ...overrides,
});

describe('clamping', () => {
  it('clamps the rate into 0.1–10', () => {
    expect(clampRate(1)).toBe(1);
    expect(clampRate(0)).toBe(0.1);
    expect(clampRate(99)).toBe(10);
    expect(clampRate(Number.NaN)).toBe(1);
  });

  it('clamps the pitch into 0–2 and the volume into 0–1', () => {
    expect(clampPitch(-1)).toBe(0);
    expect(clampPitch(3)).toBe(2);
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(clampPitch(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('normalises raw form values, coercing strings and filling defaults', () => {
    expect(normalizeSettings({})).toEqual({ voiceId: '', rate: 1, pitch: 1, volume: 1 });
    expect(normalizeSettings({ rate: '2', pitch: '0', volume: '0.5' })).toEqual({
      voiceId: '',
      rate: 2,
      pitch: 0,
      volume: 0.5,
    });
    expect(normalizeSettings({ rate: 40, pitch: 9, volume: 9, voiceId: 'v1' })).toEqual({
      voiceId: 'v1',
      rate: 10,
      pitch: 2,
      volume: 1,
    });
  });
});

describe('voice grouping and filtering', () => {
  const voices: VoiceLike[] = [
    voice('Zed', 'en-US'),
    voice('Anna', 'en-US'),
    voice('Monica', 'es-ES'),
    voice('Bad', ''),
  ];

  it('groups by language, sorts groups and sorts each group by name, skipping empty tags', () => {
    const groups = groupVoices(voices);
    expect(groups.map((g) => g.lang)).toEqual(['en-US', 'es-ES']);
    expect(groups[0]?.voices.map((v) => v.name)).toEqual(['Anna', 'Zed']);
    expect(groups[1]?.voices.map((v) => v.name)).toEqual(['Monica']);
    expect(groups[0]?.voices).toHaveLength(2);
  });

  it('labels each group with the language tag and its English name', () => {
    const groups = groupVoices([voice('Anna', 'en-US')]);
    expect(groups[0]?.label).toBe('en-US · English (United States)');
    expect(languageLabel('es')).toMatch(/Spanish/);
    expect(languageLabel('')).toBe('');
  });

  it('finds a voice by URI or by name, case-insensitively', () => {
    expect(findVoice(voices, 'Anna-uri')?.name).toBe('Anna');
    expect(findVoice(voices, 'monica')?.lang).toBe('es-ES');
    expect(findVoice(voices, 'nope')).toBeUndefined();
    expect(findVoice(voices, '')).toBeUndefined();
  });
});

describe('text-length guarding', () => {
  it('leaves short text untouched', () => {
    expect(guardTextLength('hello')).toEqual({ text: 'hello', truncated: false });
  });

  it('truncates text past the limit and reports it', () => {
    const { text, truncated } = guardTextLength('a'.repeat(MAX_TEXT_LENGTH + 10));
    expect(truncated).toBe(true);
    expect([...text]).toHaveLength(MAX_TEXT_LENGTH);
  });
});

describe('utterance building', () => {
  it('carries the clamped settings and counts words and characters', () => {
    const config = buildUtteranceConfig('one two three', normalizeSettings({ rate: 2 }));
    expect(config.text).toBe('one two three');
    expect(config.rate).toBe(2);
    expect(config.characters).toBe(13);
    expect(config.words).toBe(3);
    expect(config.voiceURI).toBeNull();
    expect(config.lang).toBeNull();
  });

  it('adopts the chosen voice’s URI and language', () => {
    const config = buildUtteranceConfig('hi', normalizeSettings({}), voice('Anna', 'en-GB'));
    expect(config.voiceURI).toBe('Anna-uri');
    expect(config.lang).toBe('en-GB');
  });
});

describe('planToResult', () => {
  it('renders the plan as JSON with stats and a default-voice note', () => {
    const result = planToResult(buildUtteranceConfig('hello there', normalizeSettings({})));
    expect(result.render).toBe('code');
    expect(result.language).toBe('json');
    const parsed = JSON.parse(result.output);
    expect(parsed.text).toBe('hello there');
    expect(parsed.words).toBe(2);
    expect(result.stats?.characters).toBe(11);
    expect(result.notes?.join(' ')).toMatch(/default voice/i);
    expect(result.warnings).toBeUndefined();
  });

  it('warns when the text had to be trimmed', () => {
    const result = planToResult(
      buildUtteranceConfig('a'.repeat(MAX_TEXT_LENGTH + 1), normalizeSettings({})),
    );
    expect(result.warnings?.join(' ')).toMatch(/cut to 5,000 characters/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Mounting (DOM)                                                             */
/* -------------------------------------------------------------------------- */

/** The markup `text-to-speech.astro` renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.ttsPanel = '';
  root.dataset.toolId = 'text-to-speech';
  root.innerHTML = `
    <textarea data-tts-text></textarea>
    <select data-tts-voice></select>
    <p data-tts-voice-status></p>
    <div data-options>
      <input type="range" data-opt-key="rate" data-opt-type="number" min="0.1" max="10" value="1" />
      <output data-range-out="rate"></output>
      <input type="range" data-opt-key="pitch" data-opt-type="number" min="0" max="2" value="1" />
      <output data-range-out="pitch"></output>
      <input type="range" data-opt-key="volume" data-opt-type="number" min="0" max="1" value="1" />
      <output data-range-out="volume"></output>
    </div>
    <button type="button" data-tts-play>Play</button>
    <button type="button" data-tts-pause disabled>Pause</button>
    <button type="button" data-tts-stop disabled>Stop</button>
    <button type="button" data-tts-download>Download</button>
    <button type="button" data-tts-paste>Paste</button>
    <button type="button" data-tts-clear>Clear</button>
    <p data-tts-status></p>
    <div hidden data-tts-result><div data-tts-report></div></div>
    <div hidden data-tts-error></div>
  `;
  document.body.append(root);
  return root;
}

/** The utterance fields the panel is expected to set. */
interface UtteranceLike {
  rate: number;
  pitch: number;
  volume: number;
  voiceURI: string;
  lang: string;
}

/** A stand-in engine that records what the panel asked it to do. */
interface FakeSynth {
  lastUtterance: (UtteranceLike & { text: string }) | null;
  getVoices: Mock<() => VoiceLike[]>;
  addEventListener: Mock<() => void>;
  removeEventListener: Mock<() => void>;
  speak: Mock<(utterance: UtteranceLike & { text: string }) => void>;
  cancel: Mock<() => void>;
  pause: Mock<() => void>;
  resume: Mock<() => void>;
}

function fakeSynth(voices: VoiceLike[]): FakeSynth {
  const engine: FakeSynth = {
    lastUtterance: null,
    getVoices: vi.fn<() => VoiceLike[]>(() => voices),
    addEventListener: vi.fn<() => void>(() => undefined),
    removeEventListener: vi.fn<() => void>(() => undefined),
    speak: vi.fn<(utterance: UtteranceLike & { text: string }) => void>((utterance) => {
      engine.lastUtterance = utterance;
    }),
    cancel: vi.fn<() => void>(() => undefined),
    pause: vi.fn<() => void>(() => undefined),
    resume: vi.fn<() => void>(() => undefined),
  };
  return engine;
}

let synth: FakeSynth;

/** The constructor the panel uses; its instances record the fields it sets. */
class FakeUtterance implements UtteranceLike {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voiceURI = '';
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

/** Install or remove the browser APIs the panel probes for. */
function setSpeech(enabled: boolean): void {
  vi.unstubAllGlobals();
  if (!enabled) return;
  synth = fakeSynth([voice('Anna', 'en-US'), voice('Monica', 'es-ES')]);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
}

afterEach(() => {
  setSpeech(false);
  document.body.replaceChildren();
});

describe('mountTextToSpeechPanel', () => {
  it('degrades gracefully when the browser has no speech synthesis', () => {
    setSpeech(false);
    const root = fixture();
    expect(() => mountTextToSpeechPanel(root)).not.toThrow();
    expect(root.querySelector<HTMLButtonElement>('[data-tts-play]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-tts-stop]')?.disabled).toBe(true);
    const error = root.querySelector<HTMLElement>('[data-tts-error]');
    expect(error?.hidden).toBe(false);
    expect(error?.textContent).toMatch(/does not support/i);
  });

  it('fills the voice picker from getVoices, grouped by language', () => {
    setSpeech(true);
    const root = fixture();
    mountTextToSpeechPanel(root);
    const select = root.querySelector<HTMLSelectElement>('[data-tts-voice]')!;
    expect(select.querySelectorAll('optgroup')).toHaveLength(2);
    // 1 placeholder + 2 voices.
    expect(select.querySelectorAll('option')).toHaveLength(3);
    expect(root.querySelector('[data-tts-voice-status]')?.textContent).toMatch(/2 voices/i);
  });

  it('speaks from Play with the clamped settings and reflects the transport state', () => {
    setSpeech(true);
    const root = fixture();
    mountTextToSpeechPanel(root);
    root.querySelector<HTMLTextAreaElement>('[data-tts-text]')!.value = 'Hello there';
    root.querySelector<HTMLInputElement>('[data-opt-key="rate"]')!.value = '99';

    const play = root.querySelector<HTMLButtonElement>('[data-tts-play]')!;
    play.click();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.lastUtterance?.text).toBe('Hello there');
    expect(synth.lastUtterance?.rate).toBe(10);
    expect(play.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-tts-stop]')!.disabled).toBe(false);

    const pause = root.querySelector<HTMLButtonElement>('[data-tts-pause]')!;
    pause.click();
    expect(synth.pause).toHaveBeenCalledTimes(1);
    expect(pause.textContent).toBe('Resume');
    pause.click();
    expect(synth.resume).toHaveBeenCalledTimes(1);

    root.querySelector<HTMLButtonElement>('[data-tts-stop]')!.click();
    expect(synth.cancel).toHaveBeenCalled();
    expect(root.querySelector<HTMLButtonElement>('[data-tts-play]')!.disabled).toBe(false);
  });

  it('refuses to speak empty text and shows a friendly error', () => {
    setSpeech(true);
    const root = fixture();
    mountTextToSpeechPanel(root);
    root.querySelector<HTMLButtonElement>('[data-tts-play]')!.click();
    expect(synth.speak).not.toHaveBeenCalled();
    const error = root.querySelector<HTMLElement>('[data-tts-error]');
    expect(error?.hidden).toBe(false);
    expect(error?.textContent).toMatch(/Enter some text/i);
  });

  it('explains why there is no download instead of producing a broken file', () => {
    setSpeech(true);
    const root = fixture();
    mountTextToSpeechPanel(root);
    root.querySelector<HTMLButtonElement>('[data-tts-download]')!.click();
    expect(root.querySelector('[data-tts-status]')?.textContent).toMatch(/cannot save speech/i);
  });
});