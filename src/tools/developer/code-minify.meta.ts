import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'code-minify',
  name: 'Code Minifier',
  category: 'developer',
  summary:
    'Minify JavaScript, CSS or HTML in your browser and see exactly how many bytes you save.',
  description:
    'Shrink JavaScript, CSS or HTML by stripping whitespace, comments and dead code, then compare the before and after size. Each language uses a well-known minifier that downloads only when you run the tool — nothing is uploaded.',
  keywords: [
    'minify',
    'minify javascript',
    'minify css',
    'minify html',
    'compress code',
    'terser',
    'csso',
    'html minifier',
    'reduce code size',
    'bytes saved',
    'uglify',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Detect automatically' },
        { value: 'js', label: 'JavaScript' },
        { value: 'css', label: 'CSS' },
        { value: 'html', label: 'HTML' },
      ],
      help: 'Pick the language if detection guesses wrong.',
    },
    {
      key: 'compress',
      label: 'JavaScript: compress',
      type: 'boolean',
      default: true,
      help: 'Drop dead code, fold constants and shorten expressions.',
    },
    {
      key: 'mangle',
      label: 'JavaScript: rename variables',
      type: 'boolean',
      default: true,
      help: 'Shorten local variable and parameter names where it is safe.',
    },
    {
      key: 'restructure',
      label: 'CSS: restructure rules',
      type: 'boolean',
      default: false,
      help: 'Merge selectors and rules, and remove redundant declarations.',
    },
    {
      key: 'collapseWhitespace',
      label: 'HTML: collapse whitespace',
      type: 'boolean',
      default: true,
      help: 'Reduce runs of spaces, tabs and newlines to a single space.',
    },
    {
      key: 'removeComments',
      label: 'HTML: remove comments',
      type: 'boolean',
      default: true,
      help: 'Delete HTML comments, keeping the ones browsers need.',
    },
  ],
  examples: [
    {
      title: 'Minify JavaScript',
      input:
        'function greet(name) {\n  // Say hello\n  const message = "Hello, " + name + "!";\n  return message;\n}\n',
    },
    {
      title: 'Minify CSS',
      input:
        '.card {\n  color: #ff0000;\n  margin: 0px 0px 0px 0px;\n}\n\n.card:hover {\n  color: #00ff00;\n}\n',
    },
    {
      title: 'Minify HTML',
      input: '<section class="hero">\n  <!-- Intro -->\n  <h1>  Hello   world  </h1>\n</section>\n',
    },
  ],
  faq: [
    {
      q: 'Where does the minification happen?',
      a: 'Entirely in your browser. The minifier for the language you choose is downloaded with the page and runs on your device, so the code you paste never leaves it.',
    },
    {
      q: 'Which minifier does each language use?',
      a: 'JavaScript uses terser, CSS uses csso and HTML uses html-minifier-terser.',
    },
    {
      q: 'Does minifying change how my code behaves?',
      a: 'It should not, but treat the output as a build step: keep the original source and test the minified version before you ship it.',
    },
    {
      q: 'Why did my output get bigger?',
      a: 'Very short snippets have almost nothing to strip, and HTML whitespace can be meaningful inside text. Check the byte counts in the results.',
    },
  ],
  related: ['html-to-text', 'markdown-to-html', 'json-format', 'sql-format'],
  credits: [
    { name: 'terser', url: 'https://github.com/terser/terser', license: 'BSD-2-Clause' },
    { name: 'csso', url: 'https://github.com/css/csso', license: 'MIT' },
    {
      name: 'html-minifier-terser',
      url: 'https://github.com/terser/html-minifier-terser',
      license: 'MIT',
    },
  ],
  status: 'beta',
};
