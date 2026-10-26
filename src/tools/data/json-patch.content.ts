/**
 * Editorial content for the json-patch tool page.
 *
 * Kept out of ``json-patch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a JSON Patch is',
      body: 'RFC 6902 JSON Patch is a compact list of operations — add, remove, replace, move, copy and test — that describe changes to a JSON document as data rather than as edited text. Each operation names a JSON Pointer path into the document. You paste the original document in the input and the operations in the patch option, and the tool applies them in order to return the resulting document. The original is never mutated in place.',
    },
    {
      heading: 'When to reach for it',
      body: 'Use it when you need to describe an edit programmatically — for example a small REST API change you want to inspect before sending, or a set of updates you want to share with a colleague as a reusable patch. It is also a good way to verify a patch your code generates against a sample document before it ships, because the operations are applied and the result is shown immediately.',
    },
    {
      heading: 'How paths and operations behave',
      body: 'A path starts with / and each segment is a property name or an array index, while /- appends to an array; ~1 escapes a slash and ~0 a tilde inside a property name. The test operation compares a value and fails the whole patch if it does not match; copy reads a value from the from path without removing it, while move removes the source and inserts it at the target. A move is rejected when the target would land inside the value being moved.',
    },
    {
      heading: 'Limits worth knowing',
      body: 'Operations run strictly in the order listed until one fails, and a failed operation stops processing with a message naming which one. No partial result is returned on failure — you get nothing rather than a half-patched document. The indent option only controls how the successful result is pretty-printed, choosing between 2 spaces, 4 spaces, tab or a minified single line.',
    },
    {
      heading: 'It never leaves this tab',
      body: 'Both the document and the patch are parsed and applied locally. No network requests are made, and nothing is uploaded, so you can patch a private config or a not-yet-public API shape here without it leaving your machine.',
    },
  ],
  faq: [
    {
      q: 'Which operations are supported?',
      a: 'The tool supports RFC 6902 add, remove, replace, move, copy and test. A failed operation stops processing and no partial document is returned.',
    },
    {
      q: 'What syntax do paths use?',
      a: 'Paths use JSON Pointer: they start with /, and ~1 escapes a slash while ~0 escapes a tilde in a property name. Use /- to append to an array.',
    },
    {
      q: 'Is my document uploaded?',
      a: 'No. Parsing and patching happen in your browser; no network requests are made by this tool.',
    },
  ],
} as const;
