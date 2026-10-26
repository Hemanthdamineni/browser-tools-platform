/**
 * Editorial content for the plist-decoder tool page.
 *
 * Kept out of ``plist-decoder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two plist formats, one decoded tree',
      body: 'Choose a .plist file and it decodes either flavour: the compact binary one that starts with the bplist00 magic, or the readable XML markup. Both become the same value tree, so a setting read from a binary file can be compared directly against its XML version.',
    },
    {
      heading: 'Where this saves time',
      body: 'Useful when you need to see what is actually stored inside an app bundle Info.plist, to check a preferences file against what the application reports, or to spot the difference between a debug and a release build without a Mac-only editor in the way.',
    },
    {
      heading: 'Choosing an output view',
      body: 'The Output option selects between the Value tree of paths and values, a Summary of format, byte count, version and top-level shape, and the Binary object table with its offsets. Findings collects structural problems such as duplicate keys, cyclic references, unreachable objects, trailing bytes and input that was too large. Show data blobs as base64 turns raw data values into readable base64 text.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'Binary plists permit 64-bit integers JavaScript cannot hold exactly, so those are decoded with BigInt and shown as exact decimal strings. The object table exists only for the binary format. Trees are capped at the first 2000 values, nesting at 64 levels, findings at 300 entries.',
    },
    {
      heading: 'Opened on your own machine',
      body: 'The file is read and decoded by the page itself, on device. Nothing is uploaded, no external entity is ever fetched, and reference cycles or structures that expand exponentially are cut off, so an untrusted plist cannot lock the page.',
    },
  ],
  faq: [
    {
      q: 'What is a property list?',
      a: 'It is the key-value container macOS and iOS use for settings, app bundles and archives. The same data can be written as XML or as the compact binary bplist00 format, which is what most system files on disk actually use.',
    },
    {
      q: 'How are large integers handled?',
      a: 'Binary plists allow 64-bit integers, which JavaScript numbers cannot hold exactly. Those values are decoded with BigInt and shown as exact decimal strings, so nothing is rounded.',
    },
    {
      q: 'Is it safe to open an untrusted plist?',
      a: 'Nothing is executed and no external entity is ever fetched. Reference cycles, unreachable objects and structures that expand exponentially are detected and cut off, so a crafted file cannot lock the page.',
    },
    {
      q: 'Why does the object table only appear for binary plists?',
      a: 'The offset table is part of the binary format. An XML plist is plain markup, so it has no object table to inspect.',
    },
  ],
} as const;
