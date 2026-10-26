/**
 * Editorial content for the screen-recorder tool page.
 *
 * Kept out of ``screen-recorder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Recording the screen from the tab',
      body: "The panel drives the capture: you choose a screen, window or tab through the browser's own picker, optionally switch the microphone on, and start. When you stop, the recorded file is validated and handed back for download, and the report lists its name, size, container, duration, bitrate and whether a microphone track was included.",
    },
    {
      heading: 'Demos, repro steps and walkthroughs',
      body: 'Use it to record a bug reproduction for a ticket, a short walkthrough for a colleague, or a demo of a UI you cannot install software on. Because capture happens in the browser, it also works on a locked-down machine.',
    },
    {
      heading: 'Options the panel sets',
      body: 'Recording format offers WebM and, only where the browser can record it, MP4. Video quality chooses 2.5, 5 or 8 Mbps. Microphone was included in the recording records whether the audio track is a microphone. Recording length and Recorded MIME type are filled in as the recording stops; when missing, the tool falls back to the file type and name.',
    },
    {
      heading: 'Caveats',
      body: "WebM is the format browsers reliably write; if MP4 was requested but not supported, the file is a WebM and a warning says so. An unidentifiable or empty file is flagged, and recordings past the size cap are rejected. Screen sharing needs a secure https page and the browser's permission, and ending the share stops the recording.",
    },
    {
      heading: 'Captured and kept on your device',
      body: "Your browser records the screen inside this tab and hands the file straight back to you; nothing is uploaded and no server sees the video. What gets captured is mediated by the browser's own share picker.",
    },
  ],
  faq: [
    {
      q: 'Does the recording leave my device?',
      a: 'No. Your browser records the screen inside this tab and the file is handed straight back to you for download. Nothing is uploaded.',
    },
    {
      q: 'Which format do I get?',
      a: 'WebM by default. MP4 is only offered when the browser reports that it can record MP4 — the panel hides the option otherwise, so you are never handed a file in a format your browser could not write.',
    },
    {
      q: 'Can I record my microphone too?',
      a: 'Yes. Switch the microphone on before you start recording and your voice is recorded with the screen. When the microphone is on it replaces the system audio, so the file never carries two competing audio tracks.',
    },
    {
      q: 'Why does the browser ask which screen to share?',
      a: 'That picker is the browser’s own privacy control: you choose exactly what is captured, and you can end the share at any time from the browser’s bar. Recording stops with it.',
    },
    {
      q: 'Which browsers work?',
      a: 'Any recent Chrome, Edge, Firefox or Safari on a secure (https) page. Screen sharing needs `getDisplayMedia`; without it the panel says so instead of failing.',
    },
  ],
} as const;
