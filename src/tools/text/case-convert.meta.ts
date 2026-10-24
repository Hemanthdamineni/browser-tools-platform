import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'case-convert',
  name: 'Case Converter',
  category: 'text',
  summary:
    'Convert between UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more.',
  description:
    'Switch text or an identifier between a dozen casing styles. Word boundaries are detected from spaces, punctuation and existing camelCase, so re-casing an identifier just works.',
  keywords: [
    'case',
    'uppercase',
    'lowercase',
    'title case',
    'camelcase',
    'snake_case',
    'kebab-case',
    'pascalcase',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Convert to',
      type: 'select',
      default: 'title',
      choices: [
        { value: 'upper', label: 'UPPER CASE' },
        { value: 'lower', label: 'lower case' },
        { value: 'title', label: 'Title Case' },
        { value: 'sentence', label: 'Sentence case' },
        { value: 'camel', label: 'camelCase' },
        { value: 'pascal', label: 'PascalCase' },
        { value: 'snake', label: 'snake_case' },
        { value: 'constant', label: 'CONSTANT_CASE' },
        { value: 'kebab', label: 'kebab-case' },
        { value: 'dot', label: 'dot.case' },
        { value: 'path', label: 'path/case' },
        { value: 'capital', label: 'Capitalise Each Word' },
        { value: 'alternating', label: 'aLtErNaTiNg' },
        { value: 'inverse', label: 'iNVERSE (swap case)' },
      ],
    },
  ],
  examples: [
    { title: 'hello world → Title', input: 'hello world', options: { target: 'title' } },
    { title: 'user_id → camelCase', input: 'user_id_value', options: { target: 'camel' } },
    { title: 'MyComponent → kebab', input: 'MyHTTPComponent', options: { target: 'kebab' } },
  ],
  article: [
    {
      heading: 'The fourteen targets',
      body: 'The Convert to selector exposes fourteen targets in two families. Word-recombining styles — camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, dot.case and path/case — split the input into words and rejoin them. Whole-text styles — UPPER, lower, Title, Sentence, Capitalise Each Word, aLtErNaTiNg and iNVERSE — transform the string as given. Title and Sentence preserve your whitespace rather than rebuilding it.',
    },
    {
      heading: 'How identifiers are split into words',
      body: 'The word-recombining styles detect boundaries rather than relying on spaces. They split on hyphens, underscores, dots and slashes, and also at every lowercase-to-uppercase transition and at acronym boundaries, so MyHTTPComponent becomes My + HTTP + Component instead of one lump. Whole-text styles skip that splitting entirely.',
    },
    {
      heading: 'Inverse and alternating work character by character',
      body: 'iNVERSE swaps the case of every character individually, so an accidental All Caps paste can be flipped back. aLtErNaTiNg walks the string and flips case every other alphabetic character, leaving non-letters untouched. Both act on the given characters and ignore word structure, which is what makes them useful for undoing a bad paste rather than for styling prose.',
    },
    {
      heading: 'Nothing is stored or sent',
      body: 'The conversion is a pure string operation in this tab, so the text never leaves your browser and no network connection is needed. Nothing is logged, and no state carries between runs.',
    },
  ],
  faq: [
    {
      q: 'How are words detected inside an identifier?',
      a: 'Runs are split on spaces, hyphens, underscores, dots and slashes, and also at lowercase→uppercase transitions and acronym boundaries (e.g. "HTTPServer" → "HTTP" + "Server").',
    },
    {
      q: 'Why does Title Case not touch my camelCase?',
      a: 'Title Case is whitespace-preserving and works on whole words, so it capitalises each space-separated word without splitting identifiers. To re-case an identifier, use camel, snake, kebab or one of the other word-recombining targets instead.',
    },
    {
      q: 'What is the difference between Title and Capitalise Each Word?',
      a: 'Title lowercases the rest of each word (hELLO → Hello) and preserves spaces, while Capitalise Each Word only uppercases the first letter and leaves the remainder untouched.',
    },
  ],
  related: ['slugify', 'text-stats', 'whitespace-visualizer'],
  status: 'stable',
};
