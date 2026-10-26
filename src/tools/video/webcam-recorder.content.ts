/**
 * Editorial content for the webcam-recorder tool page.
 *
 * Kept out of ``webcam-recorder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Record, review, then download',
      body: 'The panel opens your camera with getUserMedia, previews the feed live and encodes the clip with the browser’s own MediaRecorder. Pressing Stop drops the finished file into a player so you can watch it back before saving. The download name is your chosen prefix plus the local date and time, so two takes never overwrite each other, and the extension follows the container the browser produced: WebM (VP9 or VP8) in Chrome and Firefox, MP4 (H.264) in Safari.',
    },
    {
      heading: 'Resolution, bitrate and sound',
      body: 'The resolution dropdown is a request rather than a command — the browser returns the closest mode your camera actually has, so a 720p webcam stays 720p even when you pick 1080p, and Auto uses whatever the camera opens with. Quality sets the target bitrate (1, 2.5 or 6 Mbit/s), which is the main thing driving file size. Microphone audio is off unless you enable it, and only then does the browser ask for microphone permission.',
    },
    {
      heading: 'The automatic stop and its limits',
      body: 'Recording halts on its own after the configured number of seconds — 300 by default, 0 for no limit — and a clip stopped before a single frame was captured is rejected rather than saved as an empty file. Cameras are only reachable from a secure context, so the page has to load over https:// or localhost.',
    },
    {
      heading: 'The recording stays in this tab',
      body: 'Video and audio are read, encoded and written to disk by this page alone. There is no upload, no server and no network request out, so it works offline and nobody but you ever sees the clip.',
    },
  ],
  faq: [
    {
      q: 'Is my recording uploaded anywhere?',
      a: 'No. The camera feed is read by this tab, encoded by the browser and saved as a file on your device. There is no server involved and no request leaves the page.',
    },
    {
      q: 'Does it record sound as well?',
      a: 'Only if you turn on “Record microphone audio” (it is off by default). When it is on, the browser asks for microphone permission and the clip carries sound. The audio is recorded by this tab, like the video — it never leaves your device.',
    },
    {
      q: 'Which resolution do I get?',
      a: 'The resolution option is a request, not a command: the browser picks the closest mode your camera actually has. A 720p webcam stays 720p even with 1080p selected; “Auto” uses whatever mode the camera opens with.',
    },
    {
      q: 'Can I choose which camera to use?',
      a: 'Yes, if your device has more than one. Once the camera starts, a picker lists the cameras the browser knows about (after permission, it can show their names). Switching cameras restarts the preview — stop the recording first.',
    },
    {
      q: 'Which format will I get?',
      a: 'Whatever your browser records best: Chrome and Firefox record WebM (VP9 or VP8), Safari records MP4 (H.264). The download uses the matching extension, so the file plays where it came from.',
    },
    {
      q: 'The camera does not start — what now?',
      a: 'Cameras only work on secure pages: open the tool over https:// (or http://localhost). You also have to allow camera access when the browser asks — the padlock in the address bar shows whether it was blocked.',
    },
    {
      q: 'How long can I record?',
      a: 'As long as you like, up to the automatic stop in the options (five minutes by default). Set that to 0 to remove the limit.',
    },
    {
      q: 'Can I check the clip before saving it?',
      a: 'Yes. The recording appears in a player on the page, so you can watch it back and only then download it.',
    },
  ],
} as const;
