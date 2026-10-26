/**
 * Editorial content for the json-to-graphql tool page.
 *
 * Kept out of ``json-to-graphql.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a JSON sample to GraphQL SDL',
      body: 'Paste a JSON object and the generator walks it in one pass: strings become String, booleans Boolean, integers Int, floats Float and null a String placeholder. Nested objects become their own types, arrays become list types, and the whole document is emitted as Schema Definition Language with one type block per object.',
    },
    {
      heading: 'How arrays and names are derived',
      body: 'An array of strings maps to [String]. An array of objects becomes a list of the singularized type name, so an items field of objects yields type Item and items: [Item]. Colliding names get a numeric suffix, and a mixed-typed array falls back to [String] with a note suggesting a union type. The top-level object takes the Root type name value.',
    },
    {
      heading: 'Nullability and indent',
      body: 'By default every field is nullable, an honest reading of a single sample. Mark non-null fields with ! appends ! only to fields whose sample holds a concrete value, leaving nulls plain. The indent option switches the emitted blocks between two and four spaces.',
    },
    {
      heading: 'Where a single sample falls short',
      body: 'An empty array cannot reveal its item type, so it becomes [String], and a key that is missing from the sample never appears in the schema. Two different objects that share a field name collapse into one type, so the output is a starting point for a schema, not a complete model. Input must be valid JSON under one million characters.',
    },
    {
      heading: 'The sample never leaves this tab',
      body: 'The JSON is parsed and the SDL generated entirely in the browser, so an API response or internal configuration sample is never posted anywhere.',
    },
  ],
  faq: [
    {
      q: 'How are scalars mapped?',
      a: 'Strings map to String, booleans to Boolean, integers to Int and floats to Float. null gets a default scalar (String) so a missing value never breaks the schema.',
    },
    {
      q: 'What about arrays?',
      a: 'Arrays become list types: an array of strings maps to [String]. If the items are objects, each object becomes a type and the field becomes a list of that type.',
    },
    {
      q: 'Is every field nullable?',
      a: 'By default fields are nullable (no !), which is the safe choice for a sample. Turn on "Mark non-null fields with !" to add ! to every field that holds a concrete value.',
    },
    {
      q: 'How is the top-level name chosen?',
      a: 'The top-level object gets the name you provide in "Root type name"; nested objects are named after their field (camelCase → PascalCase). You can rename freely afterwards.',
    },
  ],
} as const;
