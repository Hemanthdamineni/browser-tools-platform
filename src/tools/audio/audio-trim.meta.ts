import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-trim',
  name: 'Trim / Clip Audio',
  category: 'audio',
  summary: 'Cut an audio file to a range and apply click-free fade in/out edges.',
  description:
    'Trim audio to a start and end time (accepting "SS", "M:SS" or "H:MM:SS") and optionally add a short fade in and fade out so the clip starts and ends cleanly.',
  keywords: ['audio', 'trim', 'clip', 'cut', 'fade', 'wav', 'slice'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'start',
      label: 'Start time',
      type: 'text',
      default: '0:00',
      placeholder: '0:00, 1:30, 00:00:05 …',
    },
    {
      key: 'end',
      label: 'End time (empty = end)',
      type: 'text',
      default: '',
      placeholder: 'e.g. 0:45',
    },
    { key: 'fadeIn', label: 'Fade in (ms)', type: 'number', default: 0, min: 0, max: 10000 },
    { key: 'fadeOut', label: 'Fade out (ms)', type: 'number', default: 0, min: 0, max: 10000 },
  ],
  examples: [
    { title: 'First 30 seconds', options: { start: '0:00', end: '0:30' } },
    {
      title: 'Trim with fades',
      options: { start: '0:10', end: '1:00', fadeIn: 300, fadeOut: 500 },
    },
    { title: 'Long ringtone tail', options: { start: '2:05', end: '2:35', fadeOut: 1500 } },
  ],
  article: [
    {
      heading: 'Cutting a track down to a range',
      body: 'Give the tool an audio file and it decodes it in the browser, then writes a new WAV holding only the span you ask for. Times accept plain seconds such as 12.5, M:SS such as 1:30, or H:MM:SS. Leave the end box empty to keep every sample. The download is named after the original with -trimmed.wav appended.',
    },
    {
      heading: 'Pulling a ringtone out of a long recording',
      body: 'A common use is carving a short alert out of an hour-long concert or podcast. Load the file, set start to the moment you want and end a few seconds later, then trim; the product drops straight into a phone or an editor without a separate export step.',
    },
    {
      heading: 'Softer edges with the fade boxes',
      body: 'Fade in and fade out take a duration in milliseconds and scale the first and last samples toward silence. Setting 300 and 500 rounds off clicks at the joins that a hard cut would leave behind. Both are capped at ten seconds and clamped to the clip length.',
    },
    {
      heading: 'Ranges must sit inside the file',
      body: 'The start must be zero or greater and before the audio ends; the end must come after the start and no later than the final sample. Anything outside that window is refused and the real duration is reported so you can fix the numbers. Only the first file is read, and output is always WAV.',
    },
    {
      heading: 'Nothing leaves the machine',
      body: 'Decoding, cutting and fading all happen inside the tab. The audio is never uploaded and the tool needs no network connection, so private recordings stay private.',
    },
  ],
  faq: [
    {
      q: 'Which time formats can I type?',
      a: 'Seconds (12.5), minutes and seconds (1:30) and hours, minutes and seconds (00:01:30) are all recognised by the start and end boxes.',
    },
    {
      q: 'What do the fade options change?',
      a: 'Fade in and fade out take milliseconds and ramp the first and last samples of the cut toward silence, which removes the click an abrupt edge leaves. Each is limited to ten seconds.',
    },
    {
      q: 'What happens if my range is out of bounds?',
      a: 'The job is refused and the file duration is reported, because the start must be at or after zero, the end must follow the start, and neither may pass the end of the audio.',
    },
  ],
  related: ['audio-fade', 'audio-convert'],
  status: 'stable',
};
