/**
 * Editorial content for the video-info tool page.
 *
 * Kept out of ``video-info.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the report shows',
      body: 'The tool demuxes the container on this device and builds a table of the type, duration, resolution, video and audio codecs, frame rate, bitrate, and tag fields such as title and artist. Formats are identified by contents, not extension, so a renamed MP4 is still reported as MP4. It accepts what the bundled Mediabunny engine can parse — commonly MP4, MOV, WebM, MKV, MPEG-TS, Ogg and WAV.',
    },
    {
      heading: 'The three inspection options',
      body: 'Scan frames to estimate frame rate and true bitrate reads more of the file, so it is off by default; switch it on when the header-reported frame rate looks wrong. Reading title and artist tags is on by default, as is checking whether this browser can decode each track — a property of the browser, not the file.',
    },
    {
      heading: 'Reading is not the same as decoding',
      body: 'Parsing the container and its track tables is pure JavaScript, so every track appears even when decoding is unavailable. Decoding a frame needs WebCodecs; without it, or with an unsupported codec, the metadata still shows but playback or export is out of reach. A warning also appears when the duration cannot be read, as on a truncated file.',
    },
    {
      heading: 'Only the header leaves your device',
      body: 'The file is read directly from your device, so nothing is uploaded and the tool works offline once loaded. Only container metadata is examined; scan frames reads more of the stream, but those bytes never leave your machine.',
    },
  ],
  faq: [
    {
      q: 'Which formats are supported?',
      a: 'Anything the bundled Mediabunny engine can demux — commonly MP4, QuickTime (MOV), WebM, Matroska (MKV), MPEG-TS, Ogg and WAV. Files are identified by their contents, not their extension.',
    },
    {
      q: 'Why does it say a track is not decodable?',
      a: 'Reading the container only needs JavaScript, but decoding frames needs the browser WebCodecs API. When that is unavailable (or the codec is), the metadata is still shown and only playback/export is out of reach.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The file is read directly from your device by this page, and the tool works offline once it has loaded.',
    },
  ],
} as const;
