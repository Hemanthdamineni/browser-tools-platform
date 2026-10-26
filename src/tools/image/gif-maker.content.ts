/**
 * Editorial content for the gif-maker tool page.
 *
 * Kept out of ``gif-maker.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the GIF maker does',
      body: 'You choose a set of still images and the panel turns them into a timeline: drag frames into order, drop the ones you do not need, and give each its own delay. The animation is previewed and encoded in a background worker, so a long set never freezes the tab.',
    },
    {
      heading: 'Timing, delays and the GIF format',
      body: 'A GIF stores each frame delay as hundredths of a second. The panel lets you set a per-frame delay or a uniform frame rate, and the tool rounds your request down to the nearest centisecond, so 30 fps becomes 3 centiseconds and plays back at 33.3 fps.',
    },
    {
      heading: 'Ordering and trimming frames',
      body: 'Every frame on the timeline can be moved with the arrow keys, the move buttons or a drag, and removed with its delete button. Reset order restores the original upload order. Frames sent to the encoder are exactly the order shown on the grid.',
    },
    {
      heading: 'Sizes and the size limit',
      body: 'The output width sets the base size and the height follows the first frame’s aspect ratio. A size limit in megabytes guards against enormous GIFs: the tool estimates the encoded size and shrinks the dimensions, never growing them, until the estimate fits, and caps the finished bytes too.',
    },
    {
      heading: 'Privacy and limits',
      body: 'The images are decoded, drawn and encoded entirely in this tab — no request leaves the device and the page works offline once loaded. At most 20 images of up to 100 MB can be selected, a GIF is capped at 16 MB, and the preview skips sets of more than 300 frames.',
    },
  ],
  faq: [
    {
      q: 'What order will the GIF play in?',
      a: 'Exactly the order shown on the timeline. Drag a frame, focus it and use the arrow keys, or use the move buttons; delete removes it. Reset order puts the frames back in the order you uploaded them.',
    },
    {
      q: 'Why does my 30 fps animation play back at 33 fps?',
      a: 'A GIF stores each delay in hundredths of a second, so a request that is not a whole divisor of 100 has to round. 30 fps is 33.3 ms per frame, which rounds to 3 centiseconds (30 ms) — and 3 cs plays back at 33.3 fps.',
    },
    {
      q: 'Can each frame have a different delay?',
      a: 'Yes. Every frame on the timeline has its own delay box, in hundredths of a second. The Set-all-frames control applies one frame rate to every frame at once.',
    },
    {
      q: 'How is the size limit applied?',
      a: 'The tool estimates the encoded size from the frame count, dimensions and palette, then shrinks the frames (preserving the aspect ratio, never growing them) until the estimate fits. The finished GIF is also checked against the limit.',
    },
    {
      q: 'Do the GIFs loop?',
      a: 'By default they loop forever. Set the loop count to a number to play it that many times, or keep 0 for endless looping — the standard for social media.',
    },
    {
      q: 'Is my animation uploaded anywhere?',
      a: 'No. The images are assembled and encoded in your browser. The page works offline once it has loaded.',
    },
    {
      q: 'How many images can I use?',
      a: 'Up to 20 images totalling no more than 100 MB. A single GIF is capped at 16 MB, and the live preview skips sets of more than 300 frames.',
    },
  ],
} as const;
