import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-channels',
  name: 'Audio Channel Tools',
  category: 'audio',
  summary: 'Convert mono and stereo, swap channels, isolate left/right, or encode mid-side.',
  description:
    'Remix a decoded audio file without changing its sample rate: downmix to mono, duplicate to stereo, swap L/R, hear one side in both channels, or create an M/S stereo signal.',
  keywords: ['audio', 'channels', 'stereo', 'mono', 'left', 'right', 'mid-side', 'swap', 'remix'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'to-mono',
      choices: [
        { value: 'to-mono', label: 'Convert to mono' },
        { value: 'to-stereo', label: 'Convert to stereo' },
        { value: 'swap', label: 'Swap left / right' },
        { value: 'left-only', label: 'Left channel to both' },
        { value: 'right-only', label: 'Right channel to both' },
        { value: 'mid-side', label: 'Encode mid-side' },
      ],
    },
  ],
  examples: [
    { title: 'Downmix to mono', options: { operation: 'to-mono' } },
    { title: 'Swap left and right', options: { operation: 'swap' } },
    { title: 'Isolate the left side', options: { operation: 'left-only' } },
  ],
  article: [
    {
      heading: 'Six ways to remix a track',
      body: 'Decoded audio becomes plain Float32 channel buffers that are recombined without resampling. Convert to mono averages every channel into one; convert to stereo keeps stereo, duplicates a mono source, or folds more than two channels into left and right. Swap exchanges the channels, left-only and right-only send one side to both speakers, and mid-side encodes M=(L+R)/2 with S=(L−R)/2.',
    },
    {
      heading: 'Picking the right operation',
      body: 'Reach for to-mono when a phone interview drifts between speakers or you need a single track for a mono feed. Left-only or right-only rescues a channel that carries the dialogue while the other holds only music. Swap fixes a recording whose mic and instrument landed on the wrong side. Mid-side is what you want before narrowing or widening a stereo image.',
    },
    {
      heading: 'Sample rate and file format',
      body: 'Nothing is resampled here, so a 44.1 kHz or 48 kHz source comes back at exactly the same rate as a 16-bit PCM WAV. The download is named after the source file plus the operation, so interview-swap.wav is safe to keep beside the original.',
    },
    {
      heading: 'Caveats when folding channels',
      body: 'To-mono averages all source channels, so phase-inverted sides can partly cancel. When more than two channels fold to stereo the front channels are biased left and the rest right rather than following a surround down-mix, and mid-side applied to material that is already mid-side will not invert back to stereo.',
    },
    {
      heading: 'Private, in-tab decoding',
      body: 'Decoding and re-encoding both happen in this tab through the browser Web Audio API, so no audio leaves the machine and nothing is stored. The channel buffers live in memory only until the WAV is written out.',
    },
  ],
  faq: [
    {
      q: 'Does the output change sample rate?',
      a: 'No. The tool remixes channels without resampling, so the WAV comes out at the same sample rate as the source file, encoded as 16-bit PCM.',
    },
    {
      q: 'What is mid-side encoding for?',
      a: 'It writes M=(L+R)/2 and S=(L−R)/2 as two channels. Once you have the side isolated, narrowing or widening the stereo image is a small mix change on those two signals rather than on the full bandwidth.',
    },
    {
      q: 'What happens to a mono file in stereo operations?',
      a: 'To-stereo duplicates the single mono channel to both sides. To-mono on an already mono file returns it unchanged, and swap, left-only and right-only still work because the two sides are identical copies.',
    },
  ],
  related: ['audio-merge', 'audio-convert'],
  status: 'stable',
};
