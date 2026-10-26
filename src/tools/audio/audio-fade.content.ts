/**
 * Editorial content for the audio-fade tool page.
 *
 * Kept out of ``audio-fade.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What Fade Audio In / Out does',
      body: 'The tool multiplies every audio sample by a gain envelope that ramps up at the start and down at the end, so the clip eases in from silence and tails off instead of clipping abruptly. You enter a fade-in and a fade-out duration in milliseconds (each trimmed to the file length) and pick a curve. The result is a new .wav download named after the source with -faded added.',
    },
    {
      heading: 'Why the output is always WAV',
      body: 'The decoder loads the source into raw per-channel sample buffers, the envelope is applied to each channel, and the result is written back as a standard WAV file. That means a fade from any supported input — a mono voice memo or a stereo mix — lands as a decoded PCM file rather than a re-encoded compressed one, so the gain change is applied losslessly to the samples themselves.',
    },
    {
      heading: 'Choosing a curve for the mood of the edit',
      body: 'Linear is the default and reads as the most neutral. Exponential, t×t, keeps the level near silence for most of the fade and only swells near the end, which reads as a longer, softer intro; logarithmic, the square root of t, jumps to near full level almost immediately and then drifts up, a sharper attack. The same curve is used symmetrically on the fade-out edge, so a logarithmic fade-out falls away fast and then lingers.',
    },
    {
      heading: 'Limits and privacy',
      body: 'The durations are capped at 60,000 ms each and trimmed to the actual clip length, so a fade longer than the audio is simply clamped. Longer clips keep every sample, but the whole file is held in memory while it is processed. Everything runs on your device from the file you drop in — no sample is uploaded and no request is made, so the edited audio stays local to the tab.',
    },
  ],
  faq: [
    {
      q: 'Which audio formats are accepted?',
      a: 'The tool decodes whatever the bundled audio decoder understands — commonly WAV and other uncompressed formats — and always writes the result back as a .wav file. The output file is named after the source with a -faded suffix.',
    },
    {
      q: 'What do the three curve shapes sound like?',
      a: 'Linear ramps gain at a constant rate, which is the even, natural choice for most edits. Exponential (t×t) stays quiet longer and rises steeply at the end, so it sounds like a longer, softer entrance; logarithmic (square root of t) jumps up quickly and then levels out, for a sharp, immediate attack. The same choice is mirrored on the fade-out edge.',
    },
    {
      q: 'How are the durations applied?',
      a: 'The values are in milliseconds, converted to samples using the file sample rate and clamped so they never exceed the clip length. If both fades are longer than the audio combined they still fit — each is trimmed to the available frames.',
    },
  ],
} as const;
