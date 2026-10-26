/**
 * Editorial content for the toml-convert tool page.
 *
 * Kept out of ``toml-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two directions in one box',
      body: 'TOML to JSON parses a configuration file and prints the result pretty-formatted with two-space indentation. JSON to TOML serializes a top-level object back out, emitting scalar assignments first, then nested objects as [section] headers and arrays of objects as repeated [[section]] blocks, so a pyproject.toml or Cargo.toml structure survives the round trip.',
    },
    {
      heading: 'The TOML features the parser understands',
      body: 'Tables, arrays of tables, dotted keys, inline tables, nested arrays, basic, literal and multi-line strings, integers in decimal, hex, octal and binary, floats, booleans and all four date-time flavours are recognized, with comments dropped. Keys that are not bare words are re-quoted on the way back out, and date-time values stay as strings in the JSON.',
    },
    {
      heading: 'When the round trip earns its keep',
      body: 'Convert a hand-maintained netlify.toml into JSON to diff it against a generated config, or flip an API-style JSON fixture into TOML to paste into a repo. Because everything happens locally, you can paste a config that holds credentials or machine paths without worrying about where it goes.',
    },
    {
      heading: 'Nulls and shapes TOML cannot express',
      body: 'TOML has no null, so keys with null values are omitted when serializing and the result reports how many were skipped. A bare JSON scalar or array at the top level cannot become a TOML document, so wrap it in an object first. A JSON array of objects serializes as an array of tables rather than a single array value.',
    },
    {
      heading: 'Conversion stays in the tab',
      body: 'Parsing and serialization both run in the browser on the pasted text, so no document, comment or value is uploaded anywhere. The only trace left behind is the text you paste yourself.',
    },
  ],
  faq: [
    {
      q: 'Is any data uploaded?',
      a: 'No. Parsing and serialization happen inside your browser tab.',
    },
    {
      q: 'Does it support date-time values?',
      a: 'Yes — offset date-times, local date-times, local dates and local times are recognized and kept as their original string form.',
    },
    {
      q: 'What about null in JSON?',
      a: 'TOML has no null. Keys whose value is null are omitted when serializing, and the result reports how many were skipped.',
    },
  ],
} as const;
