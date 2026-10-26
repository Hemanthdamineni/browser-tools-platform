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
    {
      title: 'Attributes React renames',
      input:
        '<div class="card" tabindex="0"><label for="q">Search</label><input id="q" readonly></div>',
      options: { fragment: false },
    },
  ],
  related: ['svg-to-jsx', 'html-to-markdown', 'html-prettifier', 'markdown-to-html'],
  status: 'stable',
};
