/**
 * Editorial content for the webcam-test tool page.
 *
 * Kept out of ``webcam-test.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the panel shows you',
      body: 'Granting camera access opens a live preview and a picker of the cameras your device exposes, named "Camera 1", "Camera 2" and so on until permission is given and the real names appear. The report lists the resolution and frame rate the browser is actually delivering, so a requested 1280x720 that the sensor or driver refuses shows as the delivered value.',
    },
    {
      heading: 'How to run a proper check',
      body: 'Pick the camera you care about, set a requested resolution or leave the browser default, and watch the preview for dropped frames, colour casts and focus. The measured frame rate is counted from frames the browser really delivered, so a slow machine, browser or USB link shows a low number instead of the claimed spec. Take a snapshot to confirm exposure on a real subject.',
    },
    {
      heading: 'The requested resolution is a hint',
      body: 'The resolution option sends a getUserMedia constraint, but the browser and driver negotiate the final size. Enable the raw track settings to see the unmodified values the browser reports for the video track, which is how you compare what you asked for against what the camera really runs at.',
    },
    {
      heading: 'Black previews, and what is never recorded',
      body: 'A black preview usually means another app or tab already owns the camera, or the page is not served over https, and the panel says which. The preview is drawn by the browser, snapshots are rasterised on a canvas and handed to you as PNG downloads, and no frame is ever recorded, uploaded or stored.',
    },
  ],
  faq: [
    {
      q: 'Is my camera feed uploaded anywhere?',
      a: 'No. The preview is a live video element fed by your browser, the frame rate is counted from frames drawn in this tab, and the snapshot is encoded with a canvas here. Nothing is recorded, stored or sent over the network. The only thing the page downloads is its own JavaScript, served from this site.',
    },
    {
      q: 'Why does the measured frame rate differ from the camera spec?',
      a: 'A camera often advertises 30 fps but delivers fewer frames in dim light, or more than the display can show. The measured number counts the frames the browser actually presented during the sampling window, which is what you would see in a recording. Some browsers cannot report frames from the video at all; there the rate is sampled from the display refresh loop and is an approximation.',
    },
    {
      q: 'Why are my camera names hidden?',
      a: 'Browsers only reveal device names after you allow camera access at least once. Press Start camera to grant it, and the picker and the report will show the real names.',
    },
    {
      q: 'What happens to the snapshot?',
      a: 'It is drawn from the current frame into a PNG and offered as a download next to the report. The file is created in this tab and only leaves it if you save it.',
    },
    {
      q: 'The camera does not start — what should I check?',
      a: 'Camera access needs an https:// page (or localhost) and your permission. If another tab or app is already using the camera, close it and try again. The panel explains the exact reason for every blocker, including denied permission and a camera that is already in use.',
    },
  ],
} as const;
