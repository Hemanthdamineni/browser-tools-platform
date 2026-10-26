/**
 * Editorial content for the video-trim tool page.
 *
 * Kept out of ``video-trim.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How a trim works',
      body: 'Drop a video, set a start and end time in SS, M:SS or H:MM:SS form, and the tool picks the packets of the source stream that fall inside the range and writes them into a new file. When the source container is kept and the cut lands cleanly, nothing is decoded and re-encoded: the copied packets are byte-for-byte the originals, so the result has no generation loss at all. That is the fast path and the default. The output container can also be changed, and the audio track kept or dropped with a single switch.',
    },
    {
      heading: 'Why the cut may not land where you asked',
      body: 'A stream copy can only begin on a key frame — an intraframe the decoder needs as an anchor — so a copy usually starts at the key frame just before your in point and ends at the key frame just after your out point, which is why the clip can be a little longer than requested. The copy mode setting decides how to behave: preferred copies whenever possible and re-encodes the rest, forced copies and simply drops anything it cannot copy, and never always re-encodes, which is the choice when the cut has to land on the exact frame you set.',
    },
    {
      heading: 'When re-encoding is unavoidable',
      body: 'A container and a codec are not the same thing, and the output container has to be able to hold the source codec. An H.264 clip copied into a WebM file would be invalid, so choosing a container the codec does not fit forces a re-encode. The same happens when the cut misses a key frame and the timeline has to be rebuilt. Re-encoding preserves the picture and sound but is a second generation of compression, so a heavy re-encode of an already compressed clip can soften it slightly — keep the source container and the preferred copy mode for the cleanest result.',
    },
    {
      heading: 'Formats, limits and privacy',
      body: 'The bundled engine recognises containers by their contents rather than their extension, covering MP4, QuickTime, WebM, Matroska, MPEG-TS, Ogg and WAV, and the whole demux, copy or re-encode runs in the tab in a worker. Nothing is uploaded and the page works offline once it has loaded, so a clip you cut for a review or a proof stays on your machine from start to finish.',
    },
  ],
  faq: [
    {
      q: 'What is a stream copy?',
      a: 'The video is stored as a stream of already-encoded packets. Cutting it means picking the packets that belong to the range you want and writing them into a new file — the picture is never decoded and encoded again, so nothing is lost.',
    },
    {
      q: 'Why is my cut not exactly where I asked?',
      a: 'A stream copy can only start on a key frame, so the clip usually begins at the key frame just before your in point and ends at the key frame just after your out point. Choose “Always re-encode” if you need the cut to the exact frame.',
    },
    {
      q: 'When does the tool re-encode instead?',
      a: 'When the chosen container cannot hold the codec of the source — an H.264 clip does not fit into a WebM file without being re-encoded — or when the cut does not land on a key frame and the timeline has to be rebuilt.',
    },
    {
      q: 'Which videos are supported?',
      a: 'Anything the bundled engine can read: MP4, QuickTime (MOV), WebM, Matroska (MKV), MPEG-TS, Ogg and WAV. Files are recognised by their contents, not their extension.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is demuxed, copied or re-encoded inside your browser tab. The page works offline once it has loaded.',
    },
  ],
} as const;
