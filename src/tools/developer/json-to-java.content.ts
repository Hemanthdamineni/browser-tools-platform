/**
 * Editorial content for the json-to-java tool page.
 *
 * Kept out of ``json-to-java.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What gets generated',
      body: 'The top level must be a JSON object or an array of objects; for an array the first element shapes the root class. Every key becomes a field, and each nested object is emitted as a nested static class so the generated file compiles as a single unit. The header always imports java.util.List, and a Lombok style additionally imports lombok.Data.',
    },
    {
      heading: 'Type inference and wrappers',
      body: 'Strings map to String, whole numbers to Integer unless they exceed int range and then to Long, decimals to Double, booleans to Boolean and nulls to Object. Arrays become List of the element type. With wrapper types enabled every field uses the boxed form, so a missing or null JSON value is representable; disabling it emits primitives such as int, which cannot hold null.',
    },
    {
      heading: 'Field names come from your keys',
      body: 'Keys are camelCased, so user_name and user-name both become userName, and characters that are not legal in an identifier are stripped. A key that collides with a Java reserved word gets a trailing underscore, so class becomes class_. When two keys collapse to the same field name, only the first is kept.',
    },
    {
      heading: 'Choosing between POJO, Lombok and records',
      body: 'The POJO style writes private fields with getters and setters. Lombok emits an @Data class with fields only, leaving the boilerplate to the annotation processor. The record style emits a Java 16 or newer record with a canonical constructor and nested records, which is the shortest output but requires a modern toolchain and immutable data.',
    },
    {
      heading: 'Generation is local and instant',
      body: 'The generator runs entirely in the page — the JSON you paste is never uploaded and no request is made, so it works with the browser offline. Because the shape is inferred from a sample, a field that is absent from the sample will not appear in the generated class.',
    },
  ],
  faq: [
    {
      q: 'Which types are inferred?',
      a: 'Strings become String, whole numbers Integer (or Long when they exceed int range), decimals Double, booleans Boolean, nulls Object, nested objects a nested class, and arrays List<T>. Wrapper types are used by default so null values are safe.',
    },
    {
      q: 'How are keys turned into field names?',
      a: 'Keys are camelCased (user_name and user-name both become userName), invalid characters are stripped, and Java reserved words get a trailing underscore (class → class_).',
    },
    {
      q: 'What do the three styles emit?',
      a: 'POJO emits fields plus getters and setters; Lombok emits @Data with fields only; record emits a Java 16+ record with a canonical constructor. Nested types are emitted as nested static classes (or nested records).',
    },
  ],
} as const;
