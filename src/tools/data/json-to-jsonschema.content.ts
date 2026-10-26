/**
 * Editorial content for the json-to-jsonschema tool page.
 *
 * Kept out of ``json-to-jsonschema.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a sample value to a schema',
      body: 'Paste any JSON value — an object, an array or even a bare string — and the tool walks it to build a JSON Schema draft 2020-12 document, always stamped with the draft meta-schema URI and written as schema.json. Objects produce a properties map with a schema per key, arrays produce an items schema derived from their elements, strings, booleans, nulls map to their own types, and numbers are split into integer when they have no fractional part and number otherwise. A bare array or primitive at the root is handled just as well as an object.',
    },
    {
      heading: 'The two switches that change the shape',
      body: 'Listing every object key as required is on by default, which records the sample’s keys in the required array so a validator would reject a document missing any of them; turn it off when the sample just happened to include optional fields. The additional properties switch controls the additionalProperties keyword that is written on every object: off writes false, tightening the schema to exactly the keys seen, on writes true so extra members are permitted.',
    },
    {
      heading: 'How arrays of differing elements are merged',
      body: 'An array is rarely uniform, so element schemas are merged rather than taken from the first one. Object elements have their properties unioned, and a key is only listed as required if it appears in every element. When types disagree, integer and number collapse to number, distinct primitive types become a sorted type array such as ["integer", "string"], and shapes that cannot be reconciled are wrapped in anyOf. An empty array gets no items keyword at all.',
    },
    {
      heading: 'What it cannot infer and where it runs',
      body: 'A schema can only describe what the sample shows, so strings carry no format, length, pattern or enum, numbers carry no minimum or maximum, and there is no $defs reuse or title on nested objects — the title option applies to the root schema only. Because all of this is a single pass over text you paste, the JSON never leaves the browser; the conversion and the pretty-printed output are produced locally in the tab.',
    },
  ],
  faq: [
    {
      q: 'Which draft does it target?',
      a: 'Draft 2020-12. The output always sets "$schema" to the draft 2020-12 meta-schema URI.',
    },
    {
      q: 'How are arrays with different element shapes handled?',
      a: 'Element schemas are merged: object properties are unioned (a key present in every element stays required), and differing primitive types collapse to a "type" array such as ["integer", "string"].',
    },
    {
      q: 'Are integers distinguished from floats?',
      a: 'Yes. A whole number infers "integer"; a number with a fractional part infers "number".',
    },
  ],
} as const;
