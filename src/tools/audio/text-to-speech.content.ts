/**
 * Editorial content for the text-to-speech tool page.
 *
 * Kept out of ``text-to-speech.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the run produces',
      body: 'Speaking cannot happen inside a pure function, so the tool validates the text and settings and returns the exact speech plan as JSON: the trimmed text, the chosen voice URI or null, the clamped rate, pitch and volume, plus character and word counts. The panel, or any caller, speaks that plan through the browser speech synthesis engine, so the report and the audio always agree.',
    },
    {
      heading: 'When to use it',
      body: 'Reach for this when you want hands-free or assistive reading: an article, a set of notes, anything you would rather hear than scan. Pick a voice from the list your browser reports, which can take a moment to populate, or leave the voice blank and let the engine choose its default.',
    },
    {
      heading: 'What the three sliders change',
      body: 'Rate runs 0.1 to 10 with 1 as normal speed, pitch runs 0 to 2 with 1 as the natural tone, and volume runs 0 to 1. Every value is clamped before use, so a malformed or out-of-range number silently becomes the nearest valid setting instead of breaking the plan.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Text is cut to 5,000 characters and the report warns you when that happens, so split very long documents into paragraphs and speak them one at a time. The engine plays through your speakers and cannot be captured into a file, so there is no download. The text stays in the tab: synthesis is on-device and the page works offline.',
    },
  ],
  faq: [
    {
      q: 'Can I download the spoken audio as a file?',
      a: 'No, and the button is deliberately missing rather than broken. The Web Speech API plays its output through your speakers and offers no way to capture the audio as a file. Recording the tab’s audio with MediaRecorder cannot reliably capture the synthesized voice, so shipping a download would quietly produce nothing on most browsers. If you need an audio file, generate one on a machine that has command-line speech tools and upload the result here instead.',
    },
    {
      q: 'Why is my preferred voice missing?',
      a: 'The voice list comes from `speechSynthesis.getVoices()`, which is asynchronous — it can return an empty list until the browser’s engine is ready, so the panel also listens for the “voiceschanged” event and refills the list when the voices arrive. If a voice still does not appear, your browser may not have one installed for that language; Chromium and Firefox generally expose the voices your operating system ships.',
    },
    {
      q: 'Is there a length limit?',
      a: 'The text is trimmed to 5,000 characters before it is spoken, and a notice appears if that happens. That keeps very long documents from stalling the engine; split longer text into a few paragraphs and read them one at a time.',
    },
    {
      q: 'Does the text leave my device?',
      a: 'No. The speech is produced by the browser’s local voice engine in this tab. Nothing is recorded, stored or sent anywhere, and the page works fully offline once loaded.',
    },
  ],
} as const;
