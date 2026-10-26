/**
 * Editorial content for the json-schema-check tool page.
 *
 * Kept out of ``json-schema-check.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One JSON object in, an issue table out',
      body: 'The input is a single JSON object with two properties: schema, which may be any JSON Schema object or boolean, and document, which is any JSON value. The result is a table with one row per problem — the JSON Pointer of the failing location, the keyword that rejected it and a plain-language message — plus error and unsupported-keyword counts.',
    },
    {
      heading: 'When this subset is enough',
      body: 'Reach for it to check an API fixture against the schema you wrote, to confirm a payload shape before filing a bug, or to see what a schema actually rejects without installing a validator.',
    },
    {
      heading: 'What is really evaluated',
      body: 'Supported keywords include type (including an array of types), required, properties, additionalProperties, items, enum, const, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, minLength and maxLength counted in code points, pattern compiled with the u flag, minItems, maxItems and uniqueItems. Combinators such as allOf, anyOf, oneOf, not and $ref are recognised but not applied.',
    },
    {
      heading: 'Deliberate limits',
      body: 'Anything outside that keyword set is listed as unsupported rather than quietly ignored, so a clean result never claims more than it checked. Validation stops after 1000 issues, nesting deeper than 100 levels is refused, and the input must stay under 500 KB.',
    },
    {
      heading: 'Parsed right here in the page',
      body: 'Both the schema and the document are parsed and checked inside this tab, so nothing about your data model is transmitted. It is safe for internal API shapes, and it keeps working with no connection.',
    },
  ],
  faq: [
    {
      q: 'Does this implement the complete JSON Schema standard?',
      a: 'No. It implements a documented subset of common validation keywords. Unsupported keywords are listed in the result and are not applied; use a full JSON Schema implementation when complete specification coverage is required.',
    },
    {
      q: 'What input format should I use?',
      a: 'Provide one JSON object with schema and document properties. The document value may be any JSON value, including null or an array.',
    },
    {
      q: 'Is the document uploaded?',
      a: 'No. Parsing and validation run entirely in your browser.',
    },
    {
      q: 'What happens to keywords this tool does not support?',
      a: 'They are listed in the unsupported count and noted in the output so you know they were not evaluated. Keywords such as allOf, anyOf, oneOf, not, if/then/else and $ref are recognised by name but never applied.',
    },
    {
      q: 'How are string lengths counted?',
      a: 'minLength and maxLength count Unicode code points rather than bytes or code units, so an emoji or an accented character is one unit, matching the JSON Schema recommendation.',
    },
  ],
} as const;
