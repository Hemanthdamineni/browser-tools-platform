/**
 * Text-to-speech panel.
 *
 * Loaded on demand by `text-to-speech.astro` so no speech code ships to pages
 * that do not read text aloud.
 *
 * The panel owns the browser APIs: it populates the voice picker from
 * `speechSynthesis.getVoices()` (handling the async `voiceschanged` event),
 * builds a `SpeechSynthesisUtterance` from the current settings and drives
 * play / pause / resume / stop. Everything that is worth unit-testing — voice
 * grouping and filtering by language, clamping rate/pitch/volume, building the
 * utterance settings from the form and guarding the text length — lives in
 * pure functions in this module, so it can be tested without a DOM or a
 * `speechSynthesis` implementation (jsdom has neither).
 *
 * Nothing here talks to the network: the voices come from the browser's local
 * engine and the page never sends the text anywhere.
 */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { capabilities } from '@/lib/capabilities';
import { clamp } from '@/lib/format';
import { bindRangeOutputs, clearError, readOptions, showError } from '../workbench/shared';

/** The longest text the panel will hand to the speech engine in one go. */
export const MAX_TEXT_LENGTH = 5000;

/** The runtime shape of a `SpeechSynthesisVoice`. */
export interface VoiceLike {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
}

/** The speech controls the user has set. Values are un-clamped form inputs. */
export type TtsSettings = {
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
};

/** One group in the voice picker: all voices of a language tag. */
export interface VoiceGroup {
  lang: string;
  label: string;
  voices: VoiceLike[];
}

/** The resolved, clamped settings the speech engine is told to use. */
export interface UtteranceConfig {
  /** The text to speak, truncated to `MAX_TEXT_LENGTH` when too long. */
  text: string;
  /** The `voiceURI` of the chosen voice, or null for the browser default. */
  voiceURI: string | null;
  /** The `lang` of the chosen voice, or null for the browser default. */
  lang: string | null;
  rate: number;
  pitch: number;
  volume: number;
  /** Whether the text was cut short by the length guard. */
  truncated: boolean;
  /** Character count of the (possibly truncated) text. */
  characters: number;
  /** Word count of the (possibly truncated) text. */
  words: number;
}

const DEFAULT_SETTINGS: TtsSettings = { voiceId: '', rate: 1, pitch: 1, volume: 1 };

/** Clamp the speech rate into the range the engine accepts. */
export function clampRate(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.rate;
  return clamp(n, 0.1, 10);
}

/** Clamp the pitch into the range the engine accepts. */
export function clampPitch(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.pitch;
  return clamp(n, 0, 2);
}

/** Clamp the volume into the range the engine accepts. */
export function clampVolume(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.volume;
  return clamp(n, 0, 1);
}

/** Read a numeric form field, falling back when it is empty or malformed. */
function asFinite(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalise raw form values into clamped, finite settings. */
export function normalizeSettings(raw: Partial<TtsSettings> | OptionValues): TtsSettings {
  return {
    voiceId: typeof raw.voiceId === 'string' ? raw.voiceId : '',
    rate: clampRate(asFinite(raw.rate, DEFAULT_SETTINGS.rate)),
    pitch: clampPitch(asFinite(raw.pitch, DEFAULT_SETTINGS.pitch)),
    volume: clampVolume(asFinite(raw.volume, DEFAULT_SETTINGS.volume)),
  };
}

/** A readable display name for a BCP-47 language tag, e.g. "en" → "English". */
export function languageLabel(lang: string): string {
  if (!lang) return lang;
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'language' });
    return names.of(lang) ?? lang;
  } catch {
    return lang;
  }
}

/**
 * Group voices by their language tag, skip empties, sort the groups by
 * language, and sort the voices within each group by name. This is what the
 * picker's `<optgroup>`s are built from.
 */
export function groupVoices(voices: VoiceLike[]): VoiceGroup[] {
  const byLang = new Map<string, VoiceLike[]>();
  for (const voice of voices) {
    if (!voice || !voice.lang) continue;
    const list = byLang.get(voice.lang);
    if (list) list.push(voice);
    else byLang.set(voice.lang, [voice]);
  }
  return [...byLang.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lang, list]) => ({
      lang,
      label: `${lang} · ${languageLabel(lang)}`,
      voices: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** The voice whose `voiceURI` (or `name`) matches `id`, or undefined. */
export function findVoice(voices: VoiceLike[], id: string): VoiceLike | undefined {
  if (!id) return undefined;
  const wanted = id.trim().toLowerCase();
  return voices.find((voice) => {
    if (!voice) return false;
    return voice.voiceURI.toLowerCase() === wanted || voice.name.toLowerCase() === wanted;
  });
}

/** Cut the text down to `MAX_TEXT_LENGTH` if it is too long to speak. */
export function guardTextLength(text: string): { text: string; truncated: boolean } {
  const length = [...text].length;
  if (length <= MAX_TEXT_LENGTH) return { text, truncated: false };
  return {
    text: [...text].slice(0, MAX_TEXT_LENGTH).join(''),
    truncated: true,
  };
}

function countWords(text: string): number {
  const match = text.trim().match(/\S+/g);
  return match ? match.length : 0;
}

/**
 * Turn the current text and settings into the exact values the speech engine
 * is told to use. Pure: given the same inputs it always returns the same
 * config, so the tool's `run()` and the panel build identical plans.
 */
export function buildUtteranceConfig(
  text: string,
  settings: TtsSettings,
  voice?: VoiceLike,
): UtteranceConfig {
  const guarded = guardTextLength(text ?? '');
  return {
    text: guarded.text,
    voiceURI: voice?.voiceURI ? voice.voiceURI : null,
    lang: voice?.lang ? voice.lang : null,
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,
    truncated: guarded.truncated,
    characters: [...guarded.text].length,
    words: countWords(guarded.text),
  };
}

/** Build a `TextRunResult` report describing a speech plan. */
export function planToResult(config: UtteranceConfig): TextRunResult {
  const notes: string[] = [];
  const warnings: string[] = [];

  if (config.voiceURI) {
    notes.push(`Voice: ${config.voiceURI}${config.lang ? ` (${config.lang})` : ''}.`);
  } else {
    notes.push('No voice selected — the browser will use its default voice.');
  }
  notes.push(
    `Rate ${config.rate.toFixed(1)} · pitch ${config.pitch.toFixed(1)} · volume ${config.volume.toFixed(1)}.`,
  );
  if (config.truncated) {
    warnings.push(
      `The text was cut to ${MAX_TEXT_LENGTH.toLocaleString()} characters so it can be spoken reliably.`,
    );
  }

  return {
    output: JSON.stringify(
      {
        text: config.text,
        voice: config.voiceURI,
        rate: config.rate,
        pitch: config.pitch,
        volume: config.volume,
        characters: config.characters,
        words: config.words,
        truncated: config.truncated,
      },
      null,
      2,
    ),
    render: 'code',
    language: 'json',
    stats: {
      characters: config.characters,
      words: config.words,
      rate: config.rate,
      pitch: config.pitch,
      volume: config.volume,
    },
    notes,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * Mount the text-to-speech panel into a `[data-tts-panel]` element.
 *
 * This is the only place the panel touches `speechSynthesis`, so when a
 * browser (or jsdom) has none, the panel degrades gracefully: it shows an
 * honest message and never throws.
 */
export function mountTextToSpeechPanel(panel: HTMLElement): void {
  const textEl = panel.querySelector<HTMLTextAreaElement>('[data-tts-text]')!;
  const voiceSelect = panel.querySelector<HTMLSelectElement>('[data-tts-voice]')!;
  const voiceStatus = panel.querySelector<HTMLElement>('[data-tts-voice-status]')!;
  const optionsRoot = panel.querySelector<HTMLElement>('[data-options]') ?? panel;
  const playBtn = panel.querySelector<HTMLButtonElement>('[data-tts-play]')!;
  const pauseBtn = panel.querySelector<HTMLButtonElement>('[data-tts-pause]')!;
  const stopBtn = panel.querySelector<HTMLButtonElement>('[data-tts-stop]')!;
  const downloadBtn = panel.querySelector<HTMLButtonElement>('[data-tts-download]')!;
  const status = panel.querySelector<HTMLElement>('[data-tts-status]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-tts-error]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-tts-result]')!;

  if (!textEl || !voiceSelect || !voiceStatus || !playBtn || !pauseBtn || !stopBtn) return;

  bindRangeOutputs(panel);
  clearError(errorBox);

  const unsupported = (message: string): void => {
    playBtn.disabled = true;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    if (status) status.textContent = message;
    if (errorBox) showError(errorBox, message);
  };

  // jsdom has no speechSynthesis — degrade gracefully instead of crashing.
  if (!capabilities.speechSynthesis || typeof window.speechSynthesis === 'undefined') {
    unsupported('Your browser does not support the Web Speech API.');
    return;
  }

  const synth = window.speechSynthesis;
  const voices: VoiceLike[] = [];

  /** Rebuild the voice picker, grouped by language. */
  function populateVoices(): void {
    const available = synth.getVoices();
    voices.length = 0;
    for (const voice of available) {
      if (voice && voice.name && voice.voiceURI) {
        voices.push({
          name: voice.name,
          lang: voice.lang,
          default: voice.default,
          localService: voice.localService,
          voiceURI: voice.voiceURI,
        });
      }
    }
    const groups = groupVoices(voices);

    voiceSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Browser default';
    voiceSelect.appendChild(placeholder);

    for (const group of groups) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      for (const voice of group.voices) {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name}${voice.default ? ' (default)' : ''}`;
        optgroup.appendChild(option);
      }
      voiceSelect.appendChild(optgroup);
    }

    voiceStatus.textContent = voices.length
      ? `${voices.length} voice${voices.length === 1 ? '' : 's'} from your browser.`
      : 'No voices found — the browser will use its default voice.';
    voiceSelect.disabled = voices.length === 0;
  }

  // getVoices() is async: it may be empty until 'voiceschanged' fires.
  populateVoices();
  synth.addEventListener?.('voiceschanged', populateVoices);

  /** The settings the panel currently holds. */
  function settings(): TtsSettings {
    return normalizeSettings({
      ...readOptions(optionsRoot),
      voiceId: voiceSelect.value,
    });
  }

  /** Render the validated speech plan under the controls. */
  function renderResult(): void {
    const text = textEl.value;
    if (!text.trim() || !resultWrap) return;
    const host = resultWrap.querySelector<HTMLElement>('[data-tts-report]')!;
    if (!host) return;
    const voice = findVoice(voices, voiceSelect.value);
    const config = buildUtteranceConfig(text, settings(), voice);
    host.replaceChildren();
    const pre = document.createElement('pre');
    pre.className = 'overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed';
    pre.textContent = JSON.stringify(config, null, 2);
    host.appendChild(pre);
    resultWrap.hidden = false;
  }

  /** Build the real utterance the engine should speak. */
  function makeUtterance(): SpeechSynthesisUtterance | null {
    const text = textEl.value;
    if (!text.trim()) {
      if (status) status.textContent = 'Type some text to speak first.';
      if (errorBox) showError(errorBox, 'Enter some text to speak.', 'It cannot be blank.');
      return null;
    }
    clearError(errorBox);
    const voice = findVoice(voices, voiceSelect.value);
    const config = buildUtteranceConfig(text, settings(), voice);
    const utterance = new SpeechSynthesisUtterance(config.text);
    if (voice) utterance.voice = voice;
    if (config.lang) utterance.lang = config.lang;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    if (status) {
      status.textContent = config.truncated
        ? 'The text was trimmed to the first 5,000 characters.'
        : 'Speaking…';
    }
    return utterance;
  }

  /** Whether the engine is currently producing audio. */
  let speaking = false;
  /** Whether the engine is paused mid-sentence. */
  let paused = false;

  function syncButtons(): void {
    playBtn.disabled = speaking;
    pauseBtn.disabled = !speaking;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    stopBtn.disabled = !speaking;
  }

  playBtn.addEventListener('click', () => {
    synth.cancel();
    const utterance = makeUtterance();
    if (!utterance) return;
    paused = false;
    speaking = true;
    syncButtons();
    utterance.onstart = () => {
      speaking = true;
      paused = false;
      syncButtons();
      if (status) status.textContent = 'Speaking…';
      renderResult();
    };
    utterance.onend = () => {
      speaking = false;
      paused = false;
      syncButtons();
      if (status) status.textContent = 'Finished.';
    };
    utterance.onerror = () => {
      speaking = false;
      paused = false;
      syncButtons();
      if (status) status.textContent = 'Speech could not be started.';
      if (errorBox) {
        showError(errorBox, 'Speech synthesis failed.', 'Try a shorter text or a different voice.');
      }
    };
    synth.speak(utterance);
  });

  pauseBtn.addEventListener('click', () => {
    if (!speaking) return;
    if (paused) {
      synth.resume();
      paused = false;
      if (status) status.textContent = 'Speaking…';
    } else {
      synth.pause();
      paused = true;
      if (status) status.textContent = 'Paused.';
    }
    syncButtons();
  });

  stopBtn.addEventListener('click', () => {
    synth.cancel();
    speaking = false;
    paused = false;
    syncButtons();
    if (status) status.textContent = 'Stopped.';
  });

  // The Web Speech API cannot route its output to a file, so there is no
  // honest way to offer a download. State the limitation rather than ship a
  // button that produces nothing.
  downloadBtn?.addEventListener('click', () => {
    if (status) {
      status.textContent =
        'Browsers cannot save speech to a file — speech synthesis plays through your speakers and offers no way to capture the audio.';
    }
  });

  const clearBtn = panel.querySelector<HTMLButtonElement>('[data-tts-clear]')!;
  clearBtn?.addEventListener('click', () => {
    textEl.value = '';
    if (status) status.textContent = '';
    clearError(errorBox);
  });

  const pasteBtn = panel.querySelector<HTMLButtonElement>('[data-tts-paste]')!;
  pasteBtn?.addEventListener('click', () => {
    void navigator.clipboard
      ?.readText()
      .then((clip) => {
        if (clip) textEl.value = clip;
        clearError(errorBox);
      })
      .catch(() => {
        if (errorBox)
          showError(errorBox, 'Could not read the clipboard.', 'Paste with Ctrl/Cmd+V instead.');
      });
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-tts-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const payload = JSON.parse(btn.dataset.ttsExamplePayload ?? '{}') as {
          input?: string;
          options?: Record<string, unknown>;
        };
        textEl.value = payload.input ?? '';
        clearError(errorBox);
        if (status) status.textContent = 'Ready — press Play.';
        textEl.focus();
      } catch {
        /* malformed example */
      }
    });
  });

  window.addEventListener('pagehide', () => {
    synth.cancel();
    synth.removeEventListener?.('voiceschanged', populateVoices);
  });

  syncButtons();
}
