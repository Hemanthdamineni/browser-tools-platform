/**
 * Editorial content for the json-to-swift tool page.
 *
 * Kept out of ``json-to-swift.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A JSON sample becomes Codable structs',
      body: 'Paste a JSON object, or an array of objects, and get Swift structs that decode it: inferred property types, a nested struct for every nested object, array element types, and optionally a CodingKeys enum that maps snake_case keys to camelCase properties.',
    },
    {
      heading: 'The iOS API-model chore',
      body: 'It removes the tedious part of consuming a new endpoint: drop in a sample response from Postman, a proxy or a log and you have a model file to paste into Xcode. It is equally useful for updating a struct after an API adds fields, or for checking exactly which keys need a CodingKeys case.',
    },
    {
      heading: 'Options that shape the model',
      body: 'Root struct name sets the top-level type and prefixes the names of nested structs. Emit CodingKeys enum adds a case for exactly those keys whose spelling differs from the Swift property name. Property declaration switches between let and var, deciding whether decoded values can be mutated.',
    },
    {
      heading: 'Inference rules and limits',
      body: 'Strings become String, booleans Bool, whole numbers Int, fractional numbers Double, and arrays become typed arrays such as [String] or [NestedStruct]. A null in the sample maps to String? so it decodes to nil; present values are never optional, so mark sometimes-missing fields optional yourself. Empty arrays cannot be typed and raise an error, and primitive roots are refused. Swift keywords are backticked and colliding names are suffixed.',
    },
    {
      heading: 'Generated locally',
      body: 'The JSON is parsed and the Swift written in your browser; no payload is uploaded. Sending an internal API response through it is safe, and the whole thing works offline.',
    },
  ],
  faq: [
    {
      q: 'How are types inferred?',
      a: 'Strings become String, booleans Bool, whole numbers Int, fractional numbers Double, nested objects become nested structs, arrays become [String]/[Int]/[Bool]/[Double]/[NestedStruct]. Nulls, empty arrays and mixed arrays fall back to String? / [String], which decode safely — tighten them once you know the real type.',
    },
    {
      q: 'Why a CodingKeys enum and when is it emitted?',
      a: 'Swift decodes by property name, so snake_case JSON keys need mapping to camelCase properties. CodingKeys carries a `case property = "json_key"` for every key whose spelling differs from its Swift name. Keys that already match are left out; disable the option to rely on decoder key-decoding strategies instead.',
    },
    {
      q: 'Does this cover decoding optional values?',
      a: 'Properties generated from a present value are non-optional. A field that is null in the sample becomes String? so it decodes as nil instead of throwing. Make present-but-sometimes-missing fields optional yourself with `String?`.',
    },
    {
      q: 'What about array and empty roots?',
      a: 'A root array generates a struct for the sampled element plus a comment showing `JSONDecoder().decode([Root].self, from: data)`. An empty array cannot be typed, so it raises an error, as do primitive roots.',
    },
  ],
} as const;
