import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'subtitle-converter',
  name: 'Subtitle Converter',
  category: 'converters',
  summary:
    'Convert subtitle files between SRT and WebVTT, and shift cue timings, entirely on-device.',
  description:
    'Convert caption files between SubRip (.srt) and WebVTT (.vtt) formats, or just extract timings, in a single step. The format is auto-detected from the content (SRT timestamps use commas, VTT uses dots and a WEBVTT header). Optionally shift every cue by a fixed number of seconds — handy for fixing out-of-sync subtitles. Cue numbering is regenerated for SRT and the optional WEBVTT header is reproduced for VTT.',
  keywords: [
    'subtitle converter',
    'srt to vtt',
    'vtt to srt',
    'subtitle format',
    'webvtt',
    'srt converter',
    'subtitle sync',
    'shift subtitles',
    'caption converter',
    'subtitle timestamps',
    'srt to webvtt',
    'video captions',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Target format',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto (convert to the other format)' },
        { value: 'srt', label: 'SRT (.srt)' },
        { value: 'vtt', label: 'WebVTT (.vtt)' },
      ],
    },
    {
      key: 'shift',
      label: 'Shift timings (seconds)',
      type: 'number',
      default: 0,
      min: -86399,
      max: 86399,
      step: 0.1,
    },
  ],
  examples: [
    {
      title: 'SRT to VTT',
      input:
        '1\n00:00:01,500 --> 00:00:04,000\nWelcome back!\n\n2\n00:00:05,000 --> 00:00:06,500\nLet us begin.',
      options: {},
    },
    {
      title: 'Fix out-of-sync subtitles by +2.5s',
      input: '1\n00:00:01,500 --> 00:00:04,000\nWelcome back!',
      options: { shift: 2.5 },
    },
  ],
  faq: [
    {
      q: 'Which subtitle formats are supported?',
      a: 'SubRip (.srt) and WebVTT (.vtt). SRT timestamps use HH:MM:SS,mmm with commas and optional numeric cue ids. VTT timestamps use HH:MM:SS.mmm with dots, an optional WEBVTT header, and optional cue identifiers and cue settings which are stripped on conversion.',
    },
    {
      q: 'How does shifting work?',
      a: 'Enter a positive number of seconds to move every cue later, or a negative number to move it earlier. Sub-second values work (e.g. -0.5). Cues that would start at a negative time are clamped to zero and cues pushed entirely past zero are dropped.',
    },
    {
      q: 'Will custom VTT metadata and cue settings survive?',
      a: 'The WEBVTT header comment and cue-identifier lines are normalised away; cue settings such as align:start are dropped because SRT has no equivalent. The tool guarantees valid, standard output in the target format rather than preserving every extension.',
    },
    {
      q: 'Is there a way to see the format it detected?',
      a: 'Yes. The notes include the detected input format and the number of cues converted, and the target option can be set explicitly to override auto-detection.',
    },
  ],
  related: [  "markdown-to-html",
  "csv-to-markdown",
  "docx-to-markdown",
  "html-to-text"],
  status: 'stable',
};
