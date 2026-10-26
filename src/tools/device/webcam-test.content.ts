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
      q: 'Does the camera feed leave my device?',
      a: 'No. The preview is drawn by the browser inside this tab, the snapshot is rasterised on your machine and the report is built here as well. Nothing is uploaded, recorded or stored, and the page makes no network requests once it has loaded.',
    },
    {
      q: 'Why are the camera names missing?',
      a: 'Browsers only reveal device names after the user grants camera permission. Until then the picker shows “Camera 1”, “Camera 2” and so on, and the names appear as soon as you allow access.',
    },
    {
      q: 'Why does the frame rate differ from what the camera claims?',
      a: 'The claimed rate comes from the video track settings, while the measured rate is counted from the frames the browser actually delivered. When they disagree by more than 2 fps, the report says so — the machine, the browser or the USB link is dropping frames.',
    },
    {
      q: 'Is the snapshot stored anywhere?',
      a: 'No. The frame is drawn into a canvas in this tab and handed straight back to you as a PNG download. It is never uploaded and never kept by the site.',
    },
    {
      q: 'Why does the preview stay black?',
      a: 'A black preview usually means the camera is already in use by another app or tab, or that the page is not served over https:// — browsers only hand out cameras on secure pages. The panel tells you which of the two it is when it happens.',
    },
  ],
} as const;
