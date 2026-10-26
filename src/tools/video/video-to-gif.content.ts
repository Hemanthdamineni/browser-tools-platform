/**
 * Editorial content for the video-to-gif tool page.
 *
 * Kept out of ``video-to-gif.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What Video to GIF returns',
      body: 'Feed it a video file and it hands back one animated GIF, previewed above the download. The controls are the keep-range in seconds, a frame rate of 1 to 30 (default 10), an output width of 16 to 1280 pixels (default 480) and a palette preset. Height follows the source aspect ratio.',
    },
    {
      heading: 'When a looping clip is the right answer',
      body: 'Use it when a demonstration has to loop silently: a bug report, a pull-request comment, or a chat client that renders GIFs but not video. Trim first, since a ten-second excerpt at 10 fps is 100 frames, comfortably inside the 300-frame ceiling.',
    },
    {
      heading: 'What the palette and frame rate really change',
      body: 'Small file shares one 32-colour table across every frame and skips dithering, so it compresses hardest and bands gradients. Balanced builds a 128-colour table per frame. Best quality uses 256 colours per frame with Floyd-Steinberg dithering for the smoothest gradients. Dropping the frame rate or width cuts bytes fastest.',
    },
    {
      heading: 'Limits, codecs and sound',
      body: 'Audio is dropped, since a GIF has no soundtrack. More than 300 frames, or an estimated output over 16 MB, is refused before encoding starts. A file with no video track, or a codec WebCodecs cannot decode, raises a message pointing at H.264 MP4 or VP8/VP9 WebM.',
    },
    {
      heading: 'No upload, no server',
      body: 'Demuxing, decoding and encoding all happen in the worker on your device, so the clip and the finished GIF stay on the machine and the page keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What happens to the audio?',
      a: 'It is dropped — a GIF is a sequence of images and has no sound. Use a video converter if you need to keep the audio.',
    },
    {
      q: 'Can I check the result before saving it?',
      a: 'Yes. The finished animation is shown above the download, so you can look at the range, the size and the colours before you save the file.',
    },
    {
      q: 'Does the GIF loop?',
      a: 'Yes, it loops forever — that is how the GIF format works. The preview animates on the page as well.',
    },
    {
      q: 'How do I keep the file small?',
      a: 'Lower the frame rate and the width, and pick the "Small file" palette quality. A 480-pixel-wide GIF at 10 fps is a good starting point for social media.',
    },
    {
      q: 'Why is the preview a different size from the clip?',
      a: 'The GIF is scaled to the width you asked for and the height follows the clip’s aspect ratio, so the frame is never stretched.',
    },
    {
      q: 'How long a clip can I convert?',
      a: 'At most 300 frames, which is 30 seconds at 10 fps or 10 seconds at 30 fps. The tool says so up front instead of freezing the tab.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is demuxed, decoded and encoded in your browser. The page works offline once it has loaded.',
    },
    {
      q: 'Which videos are supported?',
      a: 'Anything this browser can decode — usually H.264 or VP8/VP9 in MP4, MOV or WebM. If the codec is not supported, the tool says so instead of producing a broken GIF.',
    },
  ],
} as const;
