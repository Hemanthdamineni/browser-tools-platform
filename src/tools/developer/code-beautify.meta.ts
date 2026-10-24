import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'code-beautify',
  name: 'Code Beautifier',
  category: 'developer',
  summary:
    'Beautify JS, TS, CSS, SCSS, Less, HTML, Vue, JSON, Markdown and YAML with Prettier, in your browser.',
  description:
    'Paste code and get it tidied by Prettier, the formatter used by millions of projects. Pick a language, or let the tool detect it, then adjust the line width, indentation, quotes and semicolons. Only the parsers for the language you choose are downloaded, and everything runs on your device.',
  keywords: [
    'prettier',
    'beautify code',
    'format code',
    'code formatter',
    'pretty print',
    'javascript formatter',
    'typescript formatter',
    'css formatter',
    'json formatter',
    'html formatter',
    'yaml formatter',
    'markdown formatter',
    'indent code',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'auto',
      help: 'Auto-detect reads the input and picks a parser, or choose one yourself.',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'babel', label: 'JavaScript / JSX' },
        { value: 'typescript', label: 'TypeScript / TSX' },
        { value: 'css', label: 'CSS' },
        { value: 'scss', label: 'SCSS' },
        { value: 'less', label: 'Less' },
        { value: 'json', label: 'JSON' },
        { value: 'html', label: 'HTML' },
        { value: 'vue', label: 'Vue (single-file component)' },
        { value: 'markdown', label: 'Markdown' },
        { value: 'yaml', label: 'YAML' },
      ],
    },
    {
      key: 'printWidth',
      label: 'Line width',
      type: 'number',
      default: 80,
      min: 20,
      max: 200,
      help: 'Prettier wraps lines longer than this where it can.',
    },
    {
      key: 'tabWidth',
      label: 'Indent width',
      type: 'number',
      default: 2,
      min: 1,
      max: 8,
      help: 'Number of spaces per indent level.',
    },
    {
      key: 'semi',
      label: 'End statements with a semicolon',
      type: 'boolean',
      default: true,
      help: 'JavaScript and TypeScript only.',
    },
    {
      key: 'singleQuote',
      label: 'Use single quotes',
      type: 'boolean',
      default: false,
      help: 'JavaScript and TypeScript only.',
    },
    {
      key: 'trailingComma',
      label: 'Trailing commas',
      type: 'select',
      default: 'all',
      help: 'Where Prettier may add a comma after the last item. JavaScript, TypeScript and JSON only.',
      choices: [
        { value: 'all', label: 'Wherever possible' },
        { value: 'es5', label: 'ES5 (arrays and objects)' },
        { value: 'none', label: 'Never' },
      ],
    },
  ],
  examples: [
    {
      title: 'JavaScript',
      input: 'const greet=(name)=>{return `hi ${name}`}',
    },
    {
      title: 'TypeScript',
      input: 'interface User{id:number;name:string}\nconst u:User={id:1,name:"Ada"}',
      options: { language: 'typescript' },
    },
    {
      title: 'JSON',
      input: '{"b":2,"a":[1,2,3]}',
      options: { language: 'json' },
    },
    {
      title: 'CSS',
      input: 'a{color:red;margin:0 1px}',
      options: { language: 'css' },
    },
    {
      title: 'HTML',
      input: '<div><p>Hello</p></div>',
      options: { language: 'html' },
    },
    {
      title: 'Markdown',
      input: '# Title\n\nSome    spaced    text',
      options: { language: 'markdown' },
    },
    {
      title: 'YAML',
      input: 'name: toolbench\nitems:\n - one\n - two',
      options: { language: 'yaml' },
    },
  ],
  article: [
    {
      heading: 'One formatter, eleven languages',
      body: 'Paste a snippet and choose a language — JavaScript, TypeScript, CSS, SCSS, Less, HTML, Vue single-file components, JSON, Markdown or YAML — or leave it on auto-detect so the parser is sniffed from the content. The output is the same Prettier style editors and CI pipelines apply, not a bespoke tidy-up of the input.',
    },
    {
      heading: 'When a minified snippet needs reading',
      body: 'The common trigger is code that arrived compressed or mangled: a one-line bundle excerpt, a stylesheet copied out of an email, or a JSON blob lifted from a log. Here it becomes readable text you can inspect and diff before committing it anywhere.',
    },
    {
      heading: 'The options that actually change the text',
      body: 'Line width decides where Prettier wraps and indent width picks spaces per level. The semicolon toggle, the single-quote toggle and the trailing-comma choice apply to JavaScript and TypeScript only, while JSON also honours trailing commas. Markdown and YAML are reflowed by their own rules and ignore the code-style switches.',
    },
    {
      heading: 'The first run downloads one parser',
      body: 'Prettier and each language bundle load on demand, so the first format in a language waits briefly while just that parser and printer arrive; later runs reuse the cache. Source that is invalid for the chosen parser surfaces the Prettier error line instead of a silent guess.',
    },
    {
      heading: 'Your code never leaves the tab',
      body: 'Formatting happens on this device, with the formatter served from this same origin, so nothing you paste is uploaded or stored.',
    },
  ],
  faq: [
    {
      q: 'Does my code leave the browser?',
      a: 'No. Prettier runs entirely in this tab, and the formatter files are downloaded from this same site the first time you use them.',
    },
    {
      q: 'Why did the first run take a moment?',
      a: 'The formatter is only downloaded when you first use it, and only the parsers for the language you picked. Later runs reuse what is already loaded.',
    },
    {
      q: 'What does Auto-detect do?',
      a: 'It reads the input and picks the most likely language — for example JSON for a JSON object, or TypeScript when it sees type annotations. If it cannot tell, it asks you to choose a language.',
    },
    {
      q: 'The output is wrapped differently from what I expected.',
      a: 'Prettier is opinionated. Line width, indent width, quotes and semicolons are the knobs it exposes; nearly everything else is fixed.',
    },
  ],
  related: ['json-format', 'sql-format', 'diff-text', 'markdown-to-html'],
  credits: [{ name: 'Prettier', url: 'https://github.com/prettier/prettier', license: 'MIT' }],
  status: 'beta',
};
