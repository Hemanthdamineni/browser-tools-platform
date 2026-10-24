import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-convert',
  name: 'Video Converter',
  category: 'video',
  summary: 'Convert a video between MP4, WebM, MOV and MKV in your browser. Nothing is uploaded.',
  description:
    'Change a video from one container to another entirely on your device. The tool copies the streams when they already fit the target container — fast and lossless — and re-encodes only what has to change, telling you exactly which happened. MP4, WebM, MOV and MKV are all supported, in both directions.',
  keywords: [
    'video',
    'convert',
    'converter',
    'remux',
    'transcode',
    'mp4',
    'webm',
    'mov',
    'mkv',
    'matroska',
    'quicktime',
    'container',
    'codec',
    'h264',
    'vp9',
    'offline',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  options: [
    {
      key: 'container',
      label: 'Target container',
      type: 'select',
      default: 'mp4',
      choices: [
        { value: 'mp4', label: 'MP4 — plays everywhere' },
        { value: 'webm', label: 'WebM — open, small' },
        { value: 'mov', label: 'MOV (QuickTime) — Apple editors' },
        { value: 'mkv', label: 'MKV (Matroska) — holds almost anything' },
      ],
      help: 'The container the converted file is written into. The codecs inside are chosen to fit.',
    },
    {
      key: 'videoCodec',
      label: 'Video codec',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto — keep or pick whatever fits' },
        { value: 'h264', label: 'H.264 — the universal choice (MP4, MOV, MKV)' },
        { value: 'h265', label: 'H.265 — smaller, needs hardware support' },
        { value: 'vp9', label: 'VP9 — the WebM standard' },
        { value: 'vp8', label: 'VP8 — older WebM' },
        { value: 'av1', label: 'AV1 — smallest, slow to encode' },
      ],
      help: 'Auto copies the video when it already fits the container and re-encodes when it does not. A specific codec forces a re-encode into that codec and fails clearly when the browser cannot produce it.',
    },
    {
      key: 'audio',
      label: 'Keep the audio',
      type: 'boolean',
      default: true,
      help: 'Copy or convert the sound track as well. Turn it off for a smaller, silent file.',
    },
  ],
  examples: [
    { title: 'Make an MKV playable anywhere', options: { container: 'mp4' } },
    { title: 'Turn an H.264 MP4 into a WebM', options: { container: 'webm' } },
    {
      title: 'Hand a clip to a QuickTime editor',
      options: { container: 'mov' },
    },
  ],
  article: [
    {
      heading: 'Choosing where the file should end up',
      body: 'Pick MP4, WebM, MOV or MKV and the converter reads the clip from your device, then writes a copy in that container. It reports whether the streams were copied across unchanged (a remux) or re-encoded, and the finished file arrives as a normal download.',
    },
    {
      heading: 'When a container forces a re-encode',
      body: 'MP4 and MOV are built around H.264 and H.265, WebM around VP9, VP8 and AV1, while MKV accepts nearly everything. Sending an H.264 clip to WebM therefore triggers an encode, but the same clip going to MKV is copied without touching the picture.',
    },
    {
      heading: 'The three controls',
      body: 'Target container sets the wrapper. Video codec left on auto copies whatever already fits and encodes only when it must; naming a codec forces that encoder and fails clearly when the browser cannot produce it. Turning keep the audio off saves space at the cost of a silent result.',
    },
    {
      heading: 'Size ceilings',
      body: 'Two gigabytes is the largest source accepted. Because the output is muxed into memory, a conversion that would exceed 512 MB is refused before encoding starts, and anything past 64 MB carries a size warning.',
    },
    {
      heading: 'Your clip never leaves the device',
      body: 'Reading, converting and downloading all happen locally in the browser tab. No frame is uploaded, there is no network traffic, and the converter keeps working offline once the page has loaded.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between remuxing and transcoding?',
      a: 'Remuxing copies the already-compressed video and audio streams into a new container — it takes seconds and loses no quality, but only works when the codecs fit the target. Transcoding decodes the video and encodes it again, which works between any containers but takes longer and loses a little quality. The tool remuxes whenever it can and tells you which path it took.',
    },
    {
      q: 'Why was my file re-encoded even though I only changed the container?',
      a: 'A container can only hold certain codecs reliably: MP4 and MOV are built around H.264/H.265, WebM around VP9/VP8/AV1. A H.264 clip going to WebM must be re-encoded to VP9, because a WebM file with H.264 inside does not play in most players. MKV accepts nearly every codec, so conversions to MKV almost always remux.',
    },
    {
      q: 'Does converting lose quality?',
      a: 'A remux (stream copy) loses none — the original data is byte-for-byte the same in the new wrapper. A re-encode uses the source’s own bitrate so the difference is usually invisible, but any re-encode is a small loss. The result report tells you which happened.',
    },
    {
      q: 'What if my browser cannot produce the codec I asked for?',
      a: 'The tool checks what the browser can encode before it starts. If the requested codec is impossible it says so plainly and suggests the alternatives instead of writing a broken file.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is read from your device and converted in your browser. Nothing is sent over the network, and the page keeps working offline once it has loaded.',
    },
    {
      q: 'What happens to the original file?',
      a: 'Nothing — it is never modified. The converted copy is a new file you can save next to it.',
    },
  ],
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  related: ['video-compress', 'video-info', 'video-to-gif'],
  status: 'beta',
};
