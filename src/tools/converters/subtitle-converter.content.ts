/**
 * Editorial content for the subtitle-converter tool page.
 *
 * Kept out of ``subtitle-converter.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Subtitle Converter does',
      body: 'Paste the text of a subtitle file and it is parsed into individual cues, each a start time, an end time and the caption text. The format is detected from the content rather than a filename: a WEBVTT header means VTT, otherwise SRT, where timestamps use commas. The Target option picks the output — auto converts to the other format, or you can force SRT or VTT. The result is rendered as code you can copy, with notes telling you which format was detected and how many cues came out.',
    },
    {
      heading: 'Shifting out-of-sync captions',
      body: 'The shift option moves every cue by a fixed number of seconds, positive to push them later and negative to pull them earlier. It works in fractions of a second, so -0.5 shifts half a second back. A cue whose end would land at or before zero is dropped entirely, and a cue whose start would go negative is clamped to zero, so you never get a caption that starts before the clip. The note reports the exact shift applied.',
    },
    {
      heading: 'How conversion normalises the file',
      body: 'Output is always valid standard SRT or VTT rather than a copy of whatever the source contained. SRT cue numbers are regenerated in order, the WEBVTT header is reproduced for VTT, and anything SRT cannot express is dropped — VTT cue identifiers, cue settings like align:start, and the optional header comment. That trade-off guarantees clean output in the target format, at the cost of not preserving every extension.',
    },
    {
      heading: 'Edge cases and privacy',
      body: 'Input with no cue at all is rejected with a hint, as is malformed quoting. Both formats share the same timeline grammar, so a comma or dot is accepted either way and the parser tolerates a leading cue number on SRT lines. Everything runs on your device: parsing, shifting and rendering are all done in the tab, and nothing you paste is uploaded.',
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
} as const;
