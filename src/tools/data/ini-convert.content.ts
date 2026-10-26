/**
 * Editorial content for the ini-convert tool page.
 *
 * Kept out of ``ini-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Both directions of an INI conversion',
      body: 'In the default INI → JSON direction the pasted configuration is parsed into a nested object: each [section] header becomes an object, keys inside it become its members, and standalone keys before any section land at the top level. The result is pretty-printed JSON with two-space indentation. The JSON → INI direction takes an object and emits a conventional INI file, so you can round-trip a config through a structured editor and write it back in the format the program reads.',
    },
    {
      heading: 'How values are typed',
      body: 'Parsing guesses a type for every value so the JSON is useful rather than a wall of strings: true and false become booleans, whole numbers become integers, decimal and exponential forms become floats, and anything else stays a string. A key written without an equals sign becomes a bare boolean true, which matches the free-standing flag style some INI dialects use. Nothing is quoted on the way out, so the JSON reads naturally.',
    },
    {
      heading: 'Sections, nesting and arrays on the way back',
      body: 'JSON has no notion of sections, so the writer maps them: a top-level scalar becomes a root key, an object becomes a [section], and an object inside an object becomes a dotted header such as [app.database]. Arrays have no INI equivalent either, so each element is written as a repeated dotted key — entry.0, entry.1 — which is the pattern most INI readers can reconstruct. Keys keep the insertion order of the JSON object.',
    },
    {
      heading: 'Comments, quoting and other limits',
      body: 'Lines beginning with a semicolon or a hash and blank lines are skipped when parsing, and no comments are ever written back, so a round trip through INI loses them. The first equals sign on a line separates key from value, which means a value may itself contain equals signs; newlines inside a JSON string are flattened to spaces because INI has no multiline value syntax. The whole conversion runs on your device — the configuration you paste is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'How are INI values typed in JSON?',
      a: 'true/false become booleans, integer-looking values become numbers, decimal or exponential values become floats, and everything else stays a string. Keys without an equals sign become boolean true.',
    },
    {
      q: 'What does the JSON to INI direction produce?',
      a: 'Top-level scalars become root keys, objects become [section] blocks, nested objects become dotted sections like [app.database], and arrays become repeated dotted keys (entry.0 = ...). Keys are preserved in insertion order.',
    },
    {
      q: 'How are comments handled?',
      a: 'Lines starting with ; or # and blank lines are skipped while parsing. When generating INI, comments are not emitted.',
    },
    {
      q: 'What about values containing equals signs or newlines?',
      a: 'The first equals on a line splits key from value, so values may contain =. Newlines inside JSON string values are converted to spaces when writing INI, since INI has no multiline value syntax.',
    },
  ],
} as const;
