/**
 * Editorial content for the mic-test tool page.
 *
 * Kept out of ``mic-test.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What appears while you speak',
      body: 'The panel opens your microphone and shows a live level meter in dBFS with a peak-hold marker, plus a rolling waveform scope. Press record, say something, then stop: you get a clip to play back and a report with the microphone label, recording format, duration, sample rate, channel count, analysis frame and peak, RMS and average levels.',
    },
    {
      heading: 'A quick way to vet an input',
      body: 'Run it before an important call, a podcast or a screen recording to confirm the right device is live and the gain is sane. Speak normally and watch the meter: a healthy setup sits around −30 to −12 dBFS, not pinned at the top or lost in noise.',
    },
    {
      heading: 'What the three options change',
      body: 'Meter range picks how much of the scale is shown — 40, 60 or 90 dB below full scale — and a wider range reads quiet signals more precisely. Analysis frame sets how many samples each reading averages, from a snappy 256 to a smooth 4096. Recording name overrides the download filename; leave it empty to use the microphone’s own label.',
    },
    {
      heading: 'Formats, clipping and dead meters',
      body: 'The clip is whatever the browser’s MediaRecorder produces: WebM/Opus in Chrome and Firefox, MP4 in Safari. A level pinned at full scale warns the input was too hot, and a clip under half a second is flagged. A meter that never moves means a silent track or the wrong device.',
    },
    {
      heading: 'Kept on this device',
      body: 'The microphone stream is measured and recorded inside this tab. The clip is handed to you as a download, never uploaded and never stored, so nothing is kept once you close the page.',
    },
  ],
  faq: [
    {
      q: 'Does the recording leave my device?',
      a: 'No. The clip is produced by your own browser’s MediaRecorder, measured in this tab and handed to you as a download. Toolbench never uploads it and never stores it.',
    },
    {
      q: 'What does dBFS mean?',
      a: 'Decibels relative to full scale. 0 dBFS is the loudest a digital sample can be and −∞ is silence. A microphone that is working well sits around −30 to −12 dBFS while you speak normally.',
    },
    {
      q: 'Which recording format do I get?',
      a: 'Whatever your browser produces: WebM/Opus in Chrome and Firefox, MP4 in Safari. The download is named after the format that was actually recorded.',
    },
    {
      q: 'The meter does not move — what is wrong?',
      a: 'Either the browser handed back a silent track (the input may be muted in your operating system’s sound settings) or you picked the wrong input. The panel says which of the two it is.',
    },
  ],
} as const;
