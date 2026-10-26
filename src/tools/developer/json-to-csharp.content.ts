/**
 * Editorial content for the json-to-csharp tool page.
 *
 * Kept out of ``json-to-csharp.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What is produced',
      body: 'A single JSON value is the input and the output is a .cs-style module: using directives, one public class per shape, then a usage comment. Each property gets a PascalCase name, an inferred type and a default value initializer. Numbers split on whole versus fractional into int or double, strings become string, booleans bool, null object?, empty arrays List<object>, and arrays of one element kind List<string>, List<bool> or List<int>.',
    },
    {
      heading: 'When deserializing an external API response',
      body: "Reach for it when you paste a sample of an endpoint response and want DTO classes to feed straight into JsonSerializer.Deserialize. A root array emits a class for the sampled element plus a List<Root> deserialization line, and the generated types line up with System.Text.Json's default case-insensitive matching.",
    },
    {
      heading: 'rootName and attributes',
      body: 'rootName names the top class exactly as typed, trimmed, falling back to Root when empty, and doubles as the prefix for nested type names. The attributes option prepends [JsonPropertyName("key")] to every property, escaping backslashes and quotes in the key; with it off the names still deserialize case-insensitively and the header drops the serialization using.',
    },
    {
      heading: 'Edge cases to tighten',
      body: 'An empty root array is rejected because there is no element type to infer, and a bare primitive root is refused too. Inside arrays the first non-null element is sampled: mixed arrays become List<object>, and every number array is List<int> even when its values are fractional. Duplicate property names gain a numeric suffix, and a key that collides with a C# keyword is prefixed with @. The code is generated in this tab and the sample is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'What type mapping is applied?',
      a: 'strings become string, booleans bool, whole numbers int, fractional numbers double, null object?, objects become nested classes, arrays become List<T> of the sampled element type, empty arrays List<object>, and mixed arrays List<object>.',
    },
    {
      q: 'Do I need the attributes for deserialization?',
      a: 'No. System.Text.Json matches properties case-insensitively by default, so deserialization works without them. The attributes only help when you need exact key mapping, camelCase mismatch, or JSON serialization to emit different names than the C# properties.',
    },
    {
      q: 'Why are properties PascalCase?',
      a: 'The .NET naming convention is PascalCase. The generator converts snake_case and camelCase keys to PascalCase and uppercases common acronyms (URL, ID, API, JSON). The [JsonPropertyName] attribute keeps the original JSON key when attributes are enabled.',
    },
    {
      q: 'What about root arrays and empty values?',
      a: 'A root array generates a class for the sampled element and a usage comment showing List<Root>. An empty root array cannot be typed, so it errors. Empty nested arrays become List<object> and nulls become object? — tighten these to concrete types where you know them.',
    },
  ],
} as const;
