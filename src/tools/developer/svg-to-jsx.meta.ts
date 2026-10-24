import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'svg-to-jsx',
  name: 'SVG to JSX / React Component',
  category: 'developer',
  summary:
    'Convert SVG or XML markup into JSX — camelCased attributes, style objects, optional component.',
  description:
    'Turn raw SVG (or other inline markup) into JSX/TSX that React accepts: kebab-case attributes become camelCase, class becomes className, inline style strings become style objects, comments become JSX comments, and empty elements self-close. Optionally wrap the result in a typed React component with a props spread. Everything runs on your device.',
  keywords: [
    'svg to jsx',
    'svg to react',
    'svg react component',
    'convert svg jsx',
    'jsx attribute converter',
    'svg to tsx',
    'react icon component',
    'camelcase svg attributes',
    'svg props react',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'component',
      label: 'Wrap in a React component',
      type: 'boolean',
      default: true,
    },
    {
      key: 'componentName',
      label: 'Component name',
      type: 'text',
      default: 'Icon',
      placeholder: 'Icon',
    },
    {
      key: 'typescript',
      label: 'TypeScript (SVGProps)',
      type: 'boolean',
      default: true,
    },
    {
      key: 'styleObjects',
      label: 'Convert style="" to objects',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
      max: 8,
    },
  ],
  examples: [
    {
      title: 'Inline SVG as a component',
      input:
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <path d="M4 4h16v16H4z" stroke-width="2" class="icon"/>\n</svg>',
    },
    {
      title: 'Style string and comment',
      input:
        '<svg viewBox="0 0 10 10"><!-- dot --><circle cx="5" cy="5" r="4" style="fill: red; stroke-width: 2;"/></svg>',
    },
    {
      title: 'Plain JSX, no component wrapper',
      input: '<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>',
      options: { component: false, typescript: false },
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
  related: ['svg-to-png', 'html-prettifier', 'json-to-typescript', 'html-to-markdown'],
  status: 'stable',
};
