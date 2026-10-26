/**
 * Editorial content for the svg-to-jsx tool page.
 *
 * Kept out of ``svg-to-jsx.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the SVG to JSX converter does',
      body: 'Paste SVG or inline markup and it returns JSX that React accepts: kebab-case attributes are camelCased, class becomes className, for becomes htmlFor, xlink and xml prefixes are collapsed, inline style strings become style objects, comments become JSX comments and empty elements self-close. It counts converted elements, attributes and style objects.',
    },
    {
      heading: 'When to convert an icon here',
      body: 'Use it when you have an SVG from a design tool or the web and want it as a React or TypeScript component, or when you need a quick JSX fragment for an icon set and want the exact syntax React expects.',
    },
    {
      heading: 'The options that shape the output',
      body: 'Wrap in a React component, on by default, adds an exported function with a props spread and names it after Component name (default Icon, sanitised to PascalCase). TypeScript adds an SVGProps import and types the props. StyleObjects toggles style-string conversion, and Indent sets the indent width from 0 to 8 spaces. Turning the wrapper off yields bare JSX.',
    },
    {
      heading: 'What it does not check',
      body: 'Input is capped at one million characters. It reformats markup structure but does not validate geometry, references or accessibility, and nested style and script content is emitted as a template-literal child, which is what JSX requires.',
    },
    {
      heading: 'Where the conversion runs',
      body: 'The markup is parsed and rewritten on your device in this tab; your SVG is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which attributes are renamed?',
      a: 'class becomes className, for becomes htmlFor, xlink:/xml: prefixes become camelCase, and any hyphenated attribute is camelCased (stroke-width to strokeWidth). data-* and aria-* attributes are left exactly as written, and attributes without a dash such as viewBox keep their case.',
    },
    {
      q: 'How are inline style strings handled?',
      a: 'style="fill: red" becomes style={{fill: \'red\'}}. Values stay quoted strings on purpose — React would add px to bare numbers, which changes rendering.',
    },
    {
      q: 'Is the whole SVG supported?',
      a: 'The converter works on markup structure, so any element or attribute name survives the trip. Nested <style> and <script> content is emitted as a template-literal child, which is what JSX requires.',
    },
    {
      q: 'Does it validate my SVG?',
      a: 'No. It reformats markup; it does not check geometry, references, or accessibility. Use your editor for that.',
    },
  ],
} as const;
