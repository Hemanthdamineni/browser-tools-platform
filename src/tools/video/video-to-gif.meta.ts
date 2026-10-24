import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-to-gif',
  name: 'Video to GIF',
  category: 'video',
  summary:
    'Turn a clip into an animated GIF: trim it, pick the frame rate, width and palette quality.',
  description:
    'Convert a video clip into an animated GIF entirely on your device. Choose the part of the clip to keep, the frame rate, the output width and how hard the palette works, then preview the animation before you save it. Nothing is uploaded.',
  keywords: [
    'video',
    'gif',
    'animated',
    'convert',
    'clip',
    'trim',
    'frame rate',
    'fps',
    'palette',
    'loop',
    'mp4',
    'webm',
    'mov',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  options: [
    {
      key: 'start',
      label: 'Start time (seconds)',
      type: 'number',
      default: 0,
      min: 0,
      step: 0.1,
      help: 'Where the GIF starts. 0 means from the beginning of the clip.',
    },
    {
      key: 'end',
      label: 'End time (seconds)',
      type: 'number',
      default: 0,
      min: 0,
      step: 0.1,
      help: 'Where the GIF ends. 0 means to the end of the clip.',
    },
    {
      key: 'fps',
      label: 'Frame rate (fps)',
      type: 'number',
      default: 10,
      min: 1,
      max: 30,
      step: 1,
      help: 'Frames per second in the GIF. 10 fps is smooth enough and keeps the file small.',
    },
    {
      key: 'width',
      label: 'Output width (pixels)',
      type: 'number',
      default: 480,
      min: 16,
      max: 1280,
      step: 10,
      help: 'Width of the GIF. The height follows the aspect ratio of the clip.',
    },
    {
      key: 'palette',
      label: 'Palette quality',
      type: 'select',
      default: 'balanced',
      choices: [
        { value: 'small', label: 'Small file — 32 colours, one shared palette' },
        { value: 'balanced', label: 'Balanced — 128 colours, a palette per frame' },
        { value: 'high', label: 'Best quality — 256 colours, dithered' },
      ],
      help: 'How many colours the GIF may use, and whether each frame gets its own palette.',
    },
  ],
  examples: [
    { title: 'Convert a clip to an animated GIF', options: {} },
    { title: 'Trim a five-second moment', options: { start: 4, end: 9, fps: 15, width: 640 } },
    { title: 'Smallest possible loop', options: { fps: 8, width: 320, palette: 'small' } },
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
  credits: [
    { name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' },
    { name: 'gifenc', url: 'https://github.com/mattdesl/gifenc', license: 'MIT' },
  ],
  related: ['video-info'],
  status: 'beta',
};
