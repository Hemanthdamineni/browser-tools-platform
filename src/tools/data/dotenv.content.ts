/**
 * Editorial content for the dotenv tool page.
 *
 * Kept out of ``dotenv.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two directions, one paste box',
      body: 'The mode option picks the direction. In parse mode the box holds .env text and the tool returns the same keys and values as a pretty JSON object; in build mode the box holds a JSON object and the tool returns ready-to-save .env lines. The input is plain text, so a one-line snippet or a whole multi-line config file works.',
    },
    {
      heading: 'How .env text is normalised',
      body: 'Parsing trims each line, skips blanks and # comments, strips a leading export, and removes a matching pair of quotes. Inside double quotes \\n, \\t, \\r, \\" and \\\\ are decoded to real characters, and an unquoted value is cut at a space-and-# comment. The JSON output is indented into a stable shape.',
    },
    {
      heading: 'Building .env lines safely',
      body: 'Each JSON value is flattened to a string: null becomes empty, objects and arrays become JSON text, and numbers and booleans stay plain. With the quote option on (the default), a value containing a space, #, quote or backslash is wrapped in double quotes with its contents escaped.',
    },
    {
      heading: 'Expansion is opt-in and local',
      body: 'Expansion replaces ${NAME} in unquoted and double-quoted values with the value of an earlier key, leaves single-quoted text literal, and turns unknown references into empty strings, which is why it is off by default. Parsing and building both run in this tab with nothing uploaded, so variables that are often secrets stay on your device.',
    },
  ],
  faq: [
    {
      q: 'Which lines are ignored when parsing?',
      a: 'Blank lines and lines whose first non-space character is # are skipped. An "export " prefix is stripped, and matching single or double quotes around a value are removed.',
    },
    {
      q: 'How does ${VAR} expansion work?',
      a: 'With expansion on, ${NAME} in an unquoted or double-quoted value is replaced by the value of an earlier key. Single-quoted values are left literal.',
    },
    {
      q: 'Does build mode need a JSON object?',
      a: 'Yes. The top level must be a JSON object of key/value pairs, so an array or a bare scalar is rejected with an error. Nested objects become JSON text in the value rather than being flattened, which is what the JSON to .env tool is for.',
    },
  ],
} as const;
