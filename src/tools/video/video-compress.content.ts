/**
 * Editorial content for the video-compress tool page.
 *
 * Kept out of ``video-compress.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the compressor actually writes',
      body: 'Video Compressor re-encodes a clip to a smaller file in the browser. It decodes the frames, re-encodes them and the audio, and muxes a fresh MP4 or WebM, reading the finished file back before offering it as a download. Source files up to 2 GB are accepted.',
    },
    {
      heading: 'When to shrink a clip',
      body: 'Reach for it when a clip is too big to email, upload or post: a screen recording against an attachment limit, a phone video headed for a chat app, or a master file you want a smaller copy of.',
    },
    {
      heading: 'Presets, width, frame rate and container',
      body: 'Preset picks the strategy: size-50 for half the bytes, size-25 for a quarter, size-target for the megabytes you type, or a quality preset that sets the bitrate from resolution and frame rate. Width narrows the video, fps caps the frame rate, container chooses MP4 or WebM, and audio keeps or drops the sound track.',
    },
    {
      heading: 'What the compressor refuses',
      body: 'The re-encode runs in a worker, streams progress and can be cancelled. Clips up to an hour are handled; longer ones get a warning first, and a clip past the hard limits is refused up front. If the source was already compressed hard, re-encoding cannot beat it and the tool says so.',
    },
    {
      heading: 'The clip never leaves the browser',
      body: 'The video is read from your device, decoded, re-encoded and muxed entirely in the browser. Nothing is sent over the network, the page works offline once loaded, and your original file is never modified.',
    },
  ],
  faq: [
    {
      q: 'How does the tool decide how small the file should be?',
      a: 'The size presets turn the original file size into a target bitrate: "50% smaller" aims for half the bytes, "25% smaller" for a quarter, and "a specific target size" uses the number of megabytes you type. The quality presets work the other way round — they pick a bitrate from the picture size and frame rate, and let the file size fall where it may.',
    },
    {
      q: 'Will the compressed video really be smaller?',
      a: 'Usually, yes. But if the original was already compressed hard — a low bitrate recording, say — re-encoding it cannot beat it, and the tool says so instead of pretending otherwise.',
    },
    {
      q: 'Does the tool keep the sound?',
      a: 'Yes, by default the audio is re-encoded too and stays in sync with the picture. Turn "Keep the audio" off for a smaller, silent file.',
    },
    {
      q: 'Which format should I pick?',
      a: 'MP4 with H.264 plays on practically every phone, browser and video editor. WebM with VP9 is usually a little smaller for the same quality and is fully open, but older players may refuse it.',
    },
    {
      q: 'Can it handle a long recording?',
      a: 'Up to an hour. Longer clips get a warning first, because the re-encode takes a while and the finished file is held in memory until you download it. Past the limits the tool says so up front instead of freezing the tab.',
    },
    {
      q: 'Why does my browser say it cannot encode video?',
      a: 'The tool needs WebCodecs, the browser feature that does the encoding. It is available in recent Chrome, Edge and Firefox. If it is missing, the tool says so plainly rather than producing a broken file.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is read from your device, decoded, re-encoded and muxed in your browser. Nothing is sent over the network, and the page keeps working offline once it has loaded.',
    },
    {
      q: 'What happens to the original file?',
      a: 'Nothing — it is never modified. The compressed copy is a new file you can save next to it.',
    },
  ],
} as const;
