/**
 * The text-to-speech panel.
 *
 * Handles voice selection, speech synthesis, playback controls (speak/pause/resume/stop).
 */
import { speak, getAvailableVoices, type TextToSpeechOptions } from '@/tools/audio/text-to-speech.core';
import { clearError, showError } from '../workbench/shared';

export function mountTextToSpeechWorkbench(root: HTMLElement): void {
  // Elements
  const textArea = root.querySelector<HTMLTextAreaElement>('[data-tts-text]')!;
  const voiceSelect = root.querySelector<HTMLSelectElement>('[data-tts-voice]')!;
  const rateInput = root.querySelector<HTMLInputElement>('[data-tts-rate]')!;
  const pitchInput = root.querySelector<HTMLInputElement>('[data-tts-pitch]')!;
  const speakBtn = root.querySelector<HTMLButtonElement>('[data-tts-speak]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-tts-pause]')!;
  const resumeBtn = root.querySelector<HTMLButtonElement>('[data-tts-resume]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-tts-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-tts-status]')!;

  if (!textArea || !voiceSelect || !rateInput || !pitchInput || !speakBtn ||
      !pauseBtn || !resumeBtn || !stopBtn || !statusEl) {
    return;
  }

  let currentUtterance: SpeechSynthesisUtterance | null = null;
  let isPaused = false;

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function updateButtonStates(speaking: boolean, paused: boolean): void {
    speakBtn.disabled = speaking;
    pauseBtn.disabled = !speaking || paused;
    resumeBtn.disabled = !speaking || !paused;
    stopBtn.disabled = !speaking;
  }

  function resetToIdle(): void {
    if (currentUtterance) {
      speechSynthesis.cancel();
      currentUtterance = null;
    }
    isPaused = false;
    updateButtonStates(false, false);
    announce('Ready');
  }

  async function populateVoices(): Promise<void> {
    try {
      const voices = await getAvailableVoices();
      voiceSelect.innerHTML = '<option value="">Default voice</option>';
      for (const voice of voices) {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
        voiceSelect.appendChild(option);
      }
    } catch (err) {
      console.error('Failed to load voices:', err);
      announce('Could not load voice list.');
    }
  }

  function speakText(): void {
    const text = textArea.value.trim();
    if (!text) {
      showError(root, 'No text to speak', 'Enter some text in the text area.');
      return;
    }

    if (typeof speechSynthesis === 'undefined') {
      showError(root, 'Speech Synthesis not supported', 'Your browser does not support the Web Speech API.');
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const options: TextToSpeechOptions = {
      voice: voiceSelect.value || undefined,
      rate: Number(rateInput.value) || 1,
      pitch: Number(pitchInput.value) || 1,
    };

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

    utterance.onstart = () => {
      isPaused = false;
      updateButtonStates(true, false);
      announce('Speaking…');
    };

    utterance.onend = () => {
      currentUtterance = null;
      isPaused = false;
      updateButtonStates(false, false);
      announce('Finished speaking.');
    };

    utterance.onerror = (event) => {
      currentUtterance = null;
      isPaused = false;
      updateButtonStates(false, false);
      const errorMsg = event.error === 'interrupted' ? 'Speech was interrupted' : `Speech synthesis error: ${event.error}`;
      showError(root, errorMsg, 'Try again with different settings.');
      announce('Error occurred.');
    };

    utterance.onpause = () => {
      isPaused = true;
      updateButtonStates(true, true);
      announce('Paused.');
    };

    utterance.onresume = () => {
      isPaused = false;
      updateButtonStates(true, false);
      announce('Resumed.');
    };

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  }

  function pauseSpeech(): void {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
    }
  }

  function resumeSpeech(): void {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    }
  }

  function stopSpeech(): void {
    speechSynthesis.cancel();
    // The onend handler will reset state
  }

  // Event listeners
  speakBtn.addEventListener('click', speakText);
  pauseBtn.addEventListener('click', pauseSpeech);
  resumeBtn.addEventListener('click', resumeSpeech);
  stopBtn.addEventListener('click', stopSpeech);

  // Handle voice list changes
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => {
      void populateVoices();
    };
  }

  // Cleanup
  const cleanup = (): void => {
    speechSynthesis.cancel();
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initialize
  void populateVoices();
  announce('Ready');
}