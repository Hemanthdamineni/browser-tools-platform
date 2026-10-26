/**
 * Editorial content for the json-to-go-struct tool page.
 *
 * Kept out of ``json-to-go-struct.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From a JSON sample to compilable Go',
      body: 'Paste any JSON value and the tool emits Go type definitions with a struct per shape. Strings become string, booleans bool, whole numbers int and fractional numbers float64; objects become named nested structs and arrays become slices of their element type. The output compiles as-is.',
    },
    {
      heading: 'Getting the tags right',
      body: 'Every field carries a json tag matching the original key so the struct round-trips through encoding/json, and omitempty is added by default. Switch tags to none for a plain struct without annotations, for instance when you will tag it by hand.',
    },
    {
      heading: 'Names Go will accept',
      body: 'Keys are Pascal-cased, so user_name becomes UserName, and common acronyms stay uppercase — id becomes ID, url becomes URL, api becomes API. Keys that collide after casing, or that are a Go keyword such as func, get a numeric suffix so the file compiles. The root name comes from rootName and defaults to MyStruct.',
    },
    {
      heading: 'Nulls, empty containers and mixed arrays',
      body: 'A null value carries no type information and an empty array has no element type, so both become interface{} with a comment explaining why — tighten them by hand. An array of mixed types does the same. Duplicate keys resolve to the last value, matching encoding/json.',
    },
    {
      heading: 'Generated locally',
      body: 'The generator is plain string building in this tab — no Go toolchain and no server. A schema from an internal API is never uploaded, and the tool works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'How are types inferred?',
      a: 'Strings become string, booleans bool, whole numbers int, fractional numbers float64. Objects become nested named structs, and arrays become slices of their element type. A null value or an array containing mixed types becomes interface{}, flagged with a // comment so you can tighten it by hand.',
    },
    {
      q: 'Will the generated struct round-trip my JSON?',
      a: 'Yes: every field carries a json tag matching the original key (with omitempty unless you disable it), so encoding/json marshals and unmarshals the same payloads. Field names are only Go-side cosmetics and never affect the wire format.',
    },
    {
      q: 'How are field and struct names derived?',
      a: 'Keys are Pascal-cased (user_name becomes UserName) and common acronyms stay uppercase (id becomes ID, url becomes URL, api becomes API). Invalid or colliding names get a numeric suffix so the output always compiles.',
    },
    {
      q: 'What about empty containers and null?',
      a: 'An empty array has no element type to infer, so it becomes []interface{}. A null value has no type at all, so it becomes interface{}. Both receive a comment telling you the value was empty or null.',
    },
    {
      q: 'Does it handle nested or repeated shapes?',
      a: "Nested objects are hoisted into named types (one per shape) so the definition stays readable and reusable. A slice of objects gets its own element type. Duplicate keys in the JSON resolve to the last value, matching Go's encoding/json behaviour.",
    },
  ],
} as const;
