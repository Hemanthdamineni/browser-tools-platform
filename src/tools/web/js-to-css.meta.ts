import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'js-to-css',
  name: 'JS Object to CSS',
  category: 'web',
  summary:
    'Turn a JS style object into CSS: camelCase to kebab-case, numbers to px-aware values, rules support.',
  description:
    'Convert a React-style JS object (or a plain JSON object) back into CSS. camelCase keys become kebab-case, WebkitTransform becomes -webkit-transform, numbers become px where length units apply (opacity, z-index and friends stay unitless), and booleans are dropped. A bare object makes a declaration list; nested makes rules. Complements css-to-js.',
  keywords: [
    'js object to css',
    'react style to css',
    'css from js object',
    'camelCase to kebab-case css',
    'inline style to css',
    'style object to css',
    'css-in-js export',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'pxForNumbers',
      label: 'Add px for bare length numbers (12 → 12px)',
      type: 'boolean',
      default: true,
    },
  ],
  article: [
    {
      heading: 'What the converter emits',
      body: 'JS Object to CSS turns a React-style style object, or an equivalent JSON object, back into CSS. camelCase keys become kebab-case, a leading capital like WebkitTransform becomes a -webkit- prefix, quoted values are unquoted, and content values are re-quoted. A bare object becomes a declaration list and a nested object becomes rules.',
    },
    {
      heading: 'When to leave CSS-in-JS behind',
      body: 'Reach for it when moving styles out of a component into a stylesheet, or when you have a JSON style blob from a design tool or an API and need readable CSS. It is the reverse of css-to-js, so it also helps check that a round trip lost nothing.',
    },
    {
      heading: 'The px toggle and key casing',
      body: 'The pxForNumbers toggle decides what happens to bare numbers. On, a number on a length property such as width or font-size gains px, while unitless properties like opacity, z-index, line-height and font-weight stay bare and 0 is never given a unit. Off, every number is emitted as written.',
    },
    {
      heading: 'Values the converter drops',
      body: 'Booleans, null, undefined and empty values are dropped, since CSS has no equivalent for React truthiness. Input is capped at 200,000 characters and must be a balanced object literal; a missing brace or a malformed entry is reported rather than guessed at, and if every entry was nested or dropped there is nothing to convert.',
    },
    {
      heading: 'Where the object is parsed',
      body: 'The conversion runs in your browser only. Your style object is parsed and rendered on the device, never uploaded, and the tool makes no network requests.',
    },
  ],
  examples: [
    {
      title: 'React style object to CSS',
      input: '{ color: "#fff", fontSize: 12, lineHeight: 1.4 }',
    },
    {
      title: 'Nested to rules',
      input: '{ "a:hover": { color: "red" } }',
    },
    {
      title: 'Unitless numbers stay unitless',
      input: '{ opacity: 0.5, zIndex: 10, transform: "scale(1.2)" }',
    },
  ],
  faq: [
    {
      q: 'Which properties get px?',
      a: 'Bare numbers on properties that accept lengths (width, margin, font-size…) become px. Numeric props like opacity, z-index, line-height, flex-grow and font-weight stay bare because CSS treats them as unitless.',
    },
    {
      q: 'How are booleans and null handled?',
      a: 'They are dropped — React uses truthiness to disable some properties (e.g. display: false), and CSS has no equivalent.',
    },
    {
      q: 'Can I convert a whole style tree?',
      a: 'Yes. A nested object becomes rules: { "@media (max-width: 600px)": { … } } or per-selector keys work the same way as css-to-js.',
    },
  ],
  related: ['css-to-js', 'css-minifier', 'css-units', 'gradient-css'],
  status: 'stable',
};
