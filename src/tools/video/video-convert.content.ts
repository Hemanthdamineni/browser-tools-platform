/**
 * Editorial content for the video-convert tool page.
 *
 * Kept out of ``video-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
