/**
 * Editorial content for the voice-recorder tool page.
 *
 * Kept out of ``voice-recorder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How it works',
      body: 'Open the microphone, watch the live level meter, then press Record. Recording happens entirely in this tab with your browser’s own audio APIs: WAV is captured as raw 16-bit PCM, while WebM is encoded with the browser’s Opus recorder. Pause and resume at any point, and the elapsed timer keeps the true length of the take.',
    },
    {
      heading: 'WAV or WebM',
      body: 'WAV is uncompressed 16-bit PCM at your device’s sample rate: larger files, but lossless and understood by every audio editor. WebM/Opus is compressed, so a long interview or memo stays small and plays in any modern browser. Pick WAV when you plan to trim or edit the take, and WebM when you only need to listen or share it.',
    },
    {
      heading: 'If the page closes mid-take',
      body: 'Every second the take so far is checkpointed to this browser’s own storage, so a long recording is never lost all at once. If the page reloads, the last checkpointed take is offered back to you to play or download. When you press Stop the very last chunk is always captured first, so the final moment is never cut off.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Nothing is uploaded: the microphone is read, recorded and encoded on this device, and the file is handed straight to you for playback or download. Recording needs a secure (https) page and your permission, and a long take is held in memory while it is written, so extremely long sessions are bounded by the memory the browser will give a page.',
    },
  ],
  faq: [
    {
      q: 'Does the recording leave my device?',
      a: 'No. Your microphone is recorded inside this tab, the take is turned into a WAV or WebM file and handed straight back to you for playback and download. Nothing is uploaded.',
    },
    {
      q: 'What is the difference between WAV and WebM?',
      a: 'WAV is uncompressed 16-bit PCM: larger files, but editable and understood by every audio tool. WebM/Opus is compressed, so a longer take stays small and plays in any modern browser.',
    },
    {
      q: 'What happens if the page closes mid-recording?',
      a: 'Every second the take so far is checkpointed, so a long recording is never lost all at once. The last chunk is always kept when you press Stop.',
    },
  ],
} as const;
