import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-to-jsx',
  name: 'HTML to JSX',
  category: 'developer',
  summary:
    'Convert an HTML snippet to JSX: class→className, for→htmlFor, void tags self-close, indented.',
  description:
    'Turn a static HTML snippet into a React-ready JSX component body. Runs entirely on your device. Attribute names are mapped to their React forms (class→className, for→htmlFor, tabindex→tabIndex, readonly→readOnly, colspan→colSpan, …), void elements (img, input, br, hr, …) are self-closed, HTML comments become {/* … */}, and the result is indented to two spaces. Dynamic values are not invented — static markup stays static strings, so the output is predictable and reviewable.',
  keywords: [
    'html to jsx',
    'convert html to react',
    'html to jsx converter',
    'jsx generator',
    'react markup converter',
    'html to jsx online',
    'className converter',
    'html to react component',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'fragment',
      label: 'Wrap multiple roots in <>…</>',
      type: 'boolean',
      default: true,
    },
    {
      key: 'preserveComments',
      label: 'Keep comments as {/* … */}',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Navbar fragment',
      input:
        '<nav class="navbar"><a href="/home" class="link" style="color:red">Home</a><img src="logo.png"></nav>',
    },
    {
      title: 'Form row',
      input:
        '<label for="email">Email</label>\n<input type="email" id="email" readonly><br><button disabled>Save</button>',
    },
  ],
  faq: [
    {
      q: 'Does it convert CSS style strings to style objects?',
      a: 'No. inline style="…" strings are carried through unchanged as strings. Converting to React style objects would need a CSS parser and is out of scope for a markup converter.',
    },
    {
      q: 'Why are void elements self-closed?',
      a: 'JSX requires every element to have a closing form, so img, input, br, hr, meta, link and friends are emitted as <img />, <input /> etc. HTML attributes are otherwise passed through.',
    },
    {
      q: 'What about attributes I add later with expressions?',
      a: 'Static input produces static JSX. You can replace any attribute value with an expression afterwards; the converter keeps values as plain strings so nothing is guessed.',
    },
    {
      q: 'Can it handle multiple root elements?',
      a: 'Yes — with "Wrap multiple roots" enabled, several top-level elements are wrapped in a JSX fragment so the output is a valid component body.',
    },
  ],
  related: [  "svg-to-jsx",
  "html-to-markdown",
  "html-prettifier",
  "markdown-to-html"],
  status: 'stable',
};
