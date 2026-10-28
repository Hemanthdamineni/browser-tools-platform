import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-playground',
  name: 'HTML Playground',
  category: 'developer',
  summary:
    'Write HTML, CSS and JavaScript in the editor and see it render instantly in a sandboxed iframe preview.',
  description:
    'Paste or type HTML, CSS and JavaScript. The live preview updates as you type. The sandbox prevents any network requests or script execution that could leak your data. Choose a theme and reset the playground. Everything runs entirely in your browser — no uploads, no network, fully offline.',
  keywords: [
    'html playground',
    'live preview',
    'css js playground',
    'html editor',
    'iframe sandbox',
    'live html',
    'code playground',
    'html css js',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      choices: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'sand', label: 'Sand' },
      ],
      default: 'light',
    },
    {
      key: 'reset',
      label: 'Reset',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: 'Hello World', code: '<h1>Hello, World!</h1>' },
    { title: 'Todo list', code: '<ul>\n  <li>Task 1</li>\n  <li>Task 2</li>\n</ul>' },
    { title: 'Counter', code: '<button onclick="alert(\'Clicked!\')">Click me</button>' },
  ],
  faq: [
    {
      q: 'Is my code safe?',
      a: 'Yes. The preview runs in a strict sandbox (sandbox="allow-scripts allow-popups" and no allow-same-origin to prevent potential leaks). No network access.',
    },
    {
      q: 'Can I use external libraries?',
      a: 'No. The sandbox prevents any network requests. You can only use features available in the browser (DOM, CSS, vanilla JS).',
    },
    {
      q: 'How do I share my playground?',
      a: 'Copy the HTML output or screenshot the preview.',
    },
  ],
  related: [  "code-minify",
  "code-beautify",
  "mermaid-renderer"],
  status: 'beta',
};
