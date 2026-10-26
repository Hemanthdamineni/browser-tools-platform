/**
 * Editorial content for the json-to-typescript tool page.
 *
 * Kept out of ``json-to-typescript.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a sample to named type declarations',
      body: 'The tool parses one JSON value and emits TypeScript types for it. Every nested object becomes its own named type, with the name built from the parent name plus the key — an address field under Root becomes RootAddress. Array element objects get an Item suffix, so an array under a users key becomes RootUsersItem[]. The output is a runnable set of interface or type declarations you can paste into a project.',
    },
    {
      heading: 'Merging every element of an array',
      body: 'When Merge shape of every array element is on, the tool unions the shapes of all objects in an array rather than trusting only the first one. Keys present in some but not all elements become optional, and the value type is a union of every distinct type seen. Turn it off to sample just the first element and keep the type tighter.',
    },
    {
      heading: 'Choices that change the output',
      body: 'Root type name sets the name of the top-level declaration, and defaults to Root. Prefer interface produces interface blocks with semicolon properties; disabling it emits type aliases with equals signs. Mark properties readonly prefixes every field with readonly. Any key that is not a valid identifier is quoted, and a root name starting with a digit is prefixed with an underscore.',
    },
    {
      heading: 'How null and mixed values become types',
      body: 'A null value becomes the null type, a number always maps to number (JSON has no separate integer type), and an array holding several value types becomes a parenthesised union such as (number | string)[]. Because the input is a sample, generated types match what the JSON actually contains — they do not guess at fields that were missing from the data.',
    },
    {
      heading: 'Generation is fully local',
      body: 'The conversion is plain string building inside this tab and makes no network request, so it works offline and your JSON is never uploaded. The output is offered as a .ts download when you want to save it, alongside the code view in the workbench.',
    },
  ],
  faq: [
    {
      q: 'How are nested types named?',
      a: 'Each nested object gets a PascalCase name built from its parent name plus the key, e.g. an "address" key under Root becomes RootAddress. Array element objects get an "Item" suffix.',
    },
    {
      q: 'What happens with null or mixed values?',
      a: 'A null value becomes the null type; an array holding several value types becomes a parenthesised union such as (number | string)[].',
    },
    {
      q: 'Are numbers split into int and float?',
      a: 'No. JSON has one number type, so every number becomes number.',
    },
  ],
} as const;
