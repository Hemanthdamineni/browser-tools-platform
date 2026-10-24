import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'file-join',
  name: 'Join File Chunks',
  category: 'archive',
  summary: 'Join numbered file chunks into one file and verify an optional manifest.',
  description:
    'Combine split file parts locally in natural filename or upload order. If a matching JSON manifest is included, verify its parts and SHA-256 checksum.',
  keywords: ['join', 'merge', 'chunks', 'parts', 'manifest'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  multiple: true,
  options: [
    {
      key: 'sort',
      label: 'Part order',
      type: 'select',
      default: 'name',
      choices: [
        { value: 'name', label: 'Natural filename order' },
        { value: 'upload-order', label: 'Upload order' },
      ],
    },
    { key: 'outputName', label: 'Output filename', type: 'text', default: 'joined.bin' },
  ],
  examples: [
    { title: 'Join split file parts' },
    { title: 'Join parts in upload order', options: { sort: 'upload-order' } },
    { title: 'Verify a manifest and rename the output', options: { outputName: 'restored.zip' } },
  ],
  faq: [
    {
      q: 'What does the manifest actually check?',
      a: 'A file whose name ends in .manifest.json is read as JSON and compared with the selected chunks: the parts list must name the same files in the same order, each part size must equal the chunk that was read, the total size must equal the joined length, and a sha256 field must match the SHA-256 digest of the joined bytes. Any mismatch becomes a warning; the joined file is still produced so you can decide what to do.',
    },
    {
      q: 'Should I select the manifest along with the chunks?',
      a: 'Yes. Drop everything into the workbench at once and the manifest is pulled out of the join automatically — it is never concatenated into the output. Without a manifest the parts are joined silently and you only get the byte count.',
    },
    {
      q: 'How much memory does a join need?',
      a: 'Every part is read into memory and the result is assembled in a single buffer, so the joined file must fit comfortably in your browser tab. The run can be cancelled while the parts are being read, which aborts before the copy step.',
    },
  ],
  article: [
    {
      heading: 'What Join File Chunks does',
      body: 'The tool takes two or more part files, reads them in order, and writes their bytes back as a single download named by the Output filename option (joined.bin by default). Nothing is decoded or transformed — the parts are concatenated exactly as they are, so a split archive, disk image or video chunk set comes back byte-for-byte. A member named *.manifest.json is recognised as metadata rather than data and is set aside from the join.',
    },
    {
      heading: 'Choosing the order of the parts',
      body: 'Sorting is the one decision that changes the output. Natural filename order runs a numeric-aware comparison, so part2.bin lands before part10.bin and split.001 precedes split.002; plain alphabetical sorting would put part10 first, which is the classic way to corrupt a reassembled archive. Upload order instead keeps exactly the sequence you dropped the files in, which is what you want when the parts have meaningless names or came from separate selections.',
    },
    {
      heading: 'Verifying a join against a manifest',
      body: 'If the selection includes a JSON manifest, the tool compares it with what it actually read: the recorded part names in order, each expected part size, a total size, and an optional sha256 of the whole file. Each disagreement is reported as a warning with a plain description — the wrong part list, a short chunk, a size mismatch, a failed checksum — and if Web Crypto is unavailable the checksum step says so instead of silently passing.',
    },
    {
      heading: 'Limits, gaps and privacy',
      body: 'Missing or renamed parts are not detected without a manifest, so a silently absent chunk produces a shorter file rather than an error; supply the manifest when the splitter emits one. The whole job runs on your device from the files you choose: the bytes are never uploaded, no request is made, and the joined download is created locally in the tab.',
    },
  ],
  related: ['file-split'],
  status: 'stable',
};
