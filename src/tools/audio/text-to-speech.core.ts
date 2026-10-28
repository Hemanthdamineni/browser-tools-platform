import { ToolError } from '@/lib/types';

export interface TextToSpeechOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
}

export function speak(text: string, options: TextToSpeechOptions = {}): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  if (typeof globalThis.speechSynthesis === 'undefined') {
    reject(new ToolError('Speech Synthesis API not available in this environment.'));
    return promise;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;

  if (options.voice) {
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find((v) => v.name === options.voice || v.voiceURI === options.voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  utterance.onend = () => resolve();
  utterance.onerror = (event) => reject(new ToolError(`Speech synthesis error: ${event.error}`));

  speechSynthesis.speak(utterance);

  return promise;
}

export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof globalThis.speechSynthesis === 'undefined') {
      resolve([]);
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });
}

export function populateVoiceOptions(): void {
  const select = document.getElementById('voice-select') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '<option value="">Default voice</option>';

  getAvailableVoices().then((voices) => {
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      select.appendChild(option);
    }
  });
}