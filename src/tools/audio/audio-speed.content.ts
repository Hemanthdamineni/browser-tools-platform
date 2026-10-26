/**
 * Editorial content for the audio-speed tool page.
 *
 * Kept out of ``audio-speed.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How speed is changed',
      body: 'A speed of 200% means the file plays twice as fast and ends in half the time; 50% halves the pace and doubles the duration. The rate option accepts 25 through 400 percent. With preserve pitch off, the audio is resampled so the sample count shrinks or grows, which changes playback speed and pitch together, exactly like a variable-speed tape deck.',
    },
    {
      heading: 'When pitch preservation matters',
      body: 'Turn on Preserve pitch (approximate) for voice notes or lectures where you want a faster listen without the sped-up timbre. That mode runs a per-channel WSOLA-lite time stretcher with 50 percent overlap, cross-correlation alignment over a small search radius and a Hann window, so it keeps the original frequency content while changing tempo.',
    },
    {
      heading: 'What to expect from the output',
      body: 'The result is always a WAV, downloaded as your original filename plus the applied speed, such as talk-150pct.wav, and the report shows the applied rate percent plus the new duration in seconds. Pitch-preserved mode warns that time stretching is approximate and can add artifacts; plain resampling warns that pitch shifts along with speed.',
    },
    {
      heading: 'Limits and caveats',
      body: 'Extreme rates amplify artifacts: fast pitch-preserved playback can sound watery or phasey, and heavy up-sampling can blur transients. Only the first dropped file is processed, and audio must decode cleanly with the bundled decoder. Everything runs in this tab with no upload, so your clip is never sent to a server.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between the two modes?',
      a: 'Plain resampling changes the number of samples so both tempo and pitch move together, like an analog tape player. Pitch-preserved mode uses time stretching to keep the frequency content while adjusting tempo, but the WSOLA-lite alignment is approximate and can introduce artifacts.',
    },
    {
      q: 'Is the pitch-preserved result exact?',
      a: 'No. That mode is explicitly labelled approximate: the overlap-add time stretcher aligns analysis frames by cross-correlation within a small search radius, which can smudge transients. For critical audio, A/B the result against the source.',
    },
    {
      q: 'What file do I get back?',
      a: 'A WAV named after your source with the applied rate percent, for example talk.mp3 becomes talk-150pct.wav at 150 percent speed. The report also lists the new duration in seconds.',
    },
    {
      q: 'Does my audio leave this device?',
      a: 'No. The file is decoded and resampled entirely in your browser with no network activity, so nothing is uploaded.',
    },
  ],
} as const;
