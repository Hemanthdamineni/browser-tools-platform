/**
 * Editorial content for the json-to-zod tool page.
 *
 * Kept out of ``json-to-zod.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it turns a JSON sample into',
      body: 'Paste one JSON value and the tool returns a TypeScript module: an import of zod, a const bound to a z.object or z.array expression built from your sample, and an export. Objects gain a z.object with a typed key per field, strings become z.string, booleans z.boolean, and both whole and fractional numbers become z.number.',
    },
    {
      heading: 'A concrete reason to use it',
      body: 'Reach for it when you have a real API response and want runtime validation without hand-writing a schema. Paste one representative payload, and the generated schema checks every sampled field the moment you call parse in your app.',
    },
    {
      heading: 'What the variable option changes',
      body: 'The variable name field sets the identifier the schema is bound to and exported, defaulting to schema. If several generated schemas land in one file, give each a distinct name to avoid collisions.',
    },
    {
      heading: 'Where the inference stays permissive',
      body: 'Inference works from a sample, so edges stay loose: null becomes z.any, an empty array becomes z.array(z.any), and a mixed array uses its first non-null element. Sampled keys are required. Tighten the copy with .optional(), .nullable() or .int().',
    },
    {
      heading: 'Privacy and input rules',
      body: 'The JSON is parsed in this tab; nothing is uploaded and the page works offline. The input must be a single JSON value, so multiple objects or trailing commas fail. A parse error reports the first problem and asks you to check quotes, commas and brackets.',
    },
  ],
  faq: [
    {
      q: 'What do the generated types actually guarantee?',
      a: 'The schema validates the shape at runtime: required keys, the correct primitive type per field, arrays of the sampled element type. Because inference works from a sample, keys present in every observed payload are required; use .optional() to soften keys that are not always present.',
    },
    {
      q: 'How are numbers handled?',
      a: 'Both integers and decimals map to z.number(). If you need an integer-only check, add .int() to the field \u2014 the generator deliberately stays permissive so variations in your payload do not instantly fail.',
    },
    {
      q: 'What about null, empty arrays, and mixed arrays?',
      a: 'A null value infers z.any() since there is no type to learn from. An empty array becomes z.array(z.any()), and a mixed array (e.g. numbers and strings) uses the first non-null element so the schema stays valid \u2014 tighten these with .nullable() or explicit unions as needed.',
    },
    {
      q: 'How do I use the output?',
      a: 'Paste the generated code and run the schema: const parsed = schema.parse(raw) gives you validated data, and type User = z.infer<typeof schema> gives you the inferred TypeScript type automatically.',
    },
  ],
} as const;
