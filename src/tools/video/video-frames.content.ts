/**
 * Editorial content for the video-frames tool page.
 *
 * Kept out of ``video-frames.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What this tool does',
      body: 'Still-frame extraction from a video, entirely on your device. Pick a sampling mode — a frame every N seconds, or N frames spread evenly across a time range — then choose a start and end to focus on part of the clip. Each frame is decoded, scaled to the width you asked for (the height keeps the aspect ratio), and written out as a lossless PNG.',
    },
    {
      heading: 'Two layouts, two workflows',
      body: 'Individual mode hands back one PNG per frame, each with a zero-padded number so the files sort in order, and a “Download all” button zips them together. Contact-sheet mode stacks every frame into a single grid image you can save or share as one file — the number of columns is automatic unless you pin it, and a white margin keeps the thumbnails readable on any background.',
    },
    {
      heading: 'The frame cap',
      body: 'Every still is a full decode plus a PNG encode, so a long clip at a tiny interval could otherwise wedge the tab. The tool caps the count at 200 and tells you the actual number up front, suggesting a longer interval, fewer frames or a shorter range — it never silently drops frames from the middle of a clip.',
    },
    {
      heading: 'Privacy',
      body: 'The clip is demuxed, decoded and re-encoded entirely in your browser. Nothing is uploaded, nothing is stored between visits, and the page keeps working offline once it has loaded.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between the two frame modes?',
      a: '“Every N seconds” samples on a fixed clock, so a 30-second clip at 10 seconds gives frames at 0, 10, 20 and 30. “N evenly spaced frames” spreads a chosen count across the range, so 6 frames of a 30-second clip land at 0, 6, 12, 18, 24 and 30. The first and last frames always sit on the range bounds.',
    },
    {
      q: 'What is a contact sheet?',
      a: 'A single image that stacks every extracted frame into a grid, like a film contact sheet or a light table. It is the quickest way to scan a clip at a glance and is saved as one PNG you can share.',
    },
    {
      q: 'How many frames can I extract?',
      a: 'At most 200 per run — enough to browse a long clip without freezing the tab. The tool says so up front and suggests a longer interval, fewer frames or a shorter range instead of silently truncating.',
    },
    {
      q: 'Do individual frames keep the aspect ratio?',
      a: 'Yes. Each still keeps the clip’s aspect ratio at the width you asked for, so nothing is stretched. For a contact sheet every thumbnail uses the same size and the sheet canvas is sized to hold them all.',
    },
    {
      q: 'Are the frames re-encoded or are they the original picture?',
      a: 'They are decoded from the clip and re-encoded as PNG, which is lossless — the pixels are exact copies of what was on screen at that moment (including any rotation metadata).',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is demuxed, decoded and re-encoded in your browser. The page works offline once it has loaded.',
    },
    {
      q: 'Which videos are supported?',
      a: 'Anything this browser can decode — usually H.264 or VP8/VP9 in MP4, MOV or WebM. If the codec is not supported, the tool says so instead of producing blank frames.',
    },
  ],
} as const;
