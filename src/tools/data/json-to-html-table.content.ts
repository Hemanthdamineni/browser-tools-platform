/**
 * Editorial content for the json-to-html-table tool page.
 *
 * Kept out of ``json-to-html-table.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Turning a JSON array into markup',
      body: 'Paste a JSON array and the tool returns an HTML table with a thead header row and a tbody of records. An array of objects takes its headers from the keys, collecting any key seen across the rows; an array of arrays uses the first row as the header, or numbers the columns when there is only one row, so a single record still renders sensibly.',
    },
    {
      heading: 'When a table beats a JSON blob',
      body: 'It helps when you want to preview API output, a config dump or a small dataset inside a document, a wiki page or an email and real table markup reads far better than a wall of braces.',
    },
    {
      heading: 'Styling and nested values',
      body: 'The style option adds no class, a zebra class or a bordered class to the table element, leaving the CSS to you. Pretty-print nested values keeps objects and arrays inside a cell indented as JSON; switching it off compacts them onto one line.',
    },
    {
      heading: 'Escaping and edge cases',
      body: 'Escaping is on by default, so angle brackets, ampersands and quotes in cell text become entities and the markup stays valid. Input must be a non-empty array and is capped at 1,000,000 characters; strings, numbers and booleans are written as they are, while null becomes an empty cell.',
    },
    {
      heading: 'Built in the page, never transmitted',
      body: 'The table is assembled in the browser from the text you paste, so your JSON is never uploaded and the tool works without a network connection.',
    },
  ],
  faq: [
    {
      q: 'What input does it accept?',
      a: 'A JSON array. An array of objects uses the object keys as the header; an array of arrays uses the first row as the header (or numbers the columns when there is a single row). Numbers, booleans and null are preserved as their JSON values.',
    },
    {
      q: 'How are nested values handled?',
      a: 'Objects and arrays inside a cell are pretty-printed as JSON so nothing is lost, and cell text is HTML-escaped (with the option to disable it) so the table markup stays valid.',
    },
    {
      q: 'What does the Style option do?',
      a: 'It only adds a class attribute to the table element: plain leaves no class, zebra adds class "zebra" and bordered adds class "bordered". You supply the CSS that styles those classes.',
    },
  ],
} as const;
