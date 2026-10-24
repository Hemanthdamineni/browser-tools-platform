import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-similarity',
  name: 'Text Similarity & Edit Distance',
  category: 'text',
  summary: 'Compare strings with edit distance and similarity scores to find near-duplicates.',
  description:
    'Score how alike two pieces of text are with Levenshtein or Damerau-Levenshtein edit distance, or the Jaro-Winkler similarity used for record matching. Paste a list and every line is scored against a reference line, sorted so the closest matches surface first.',
  keywords: [
    'levenshtein distance',
    'damerau levenshtein',
    'jaro winkler',
    'string similarity',
    'edit distance',
    'fuzzy match',
    'near duplicate',
    'fuzzy string matching',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'metric',
      label: 'Similarity metric',
      type: 'select',
      choices: [
        { value: 'levenshtein', label: 'Levenshtein distance' },
        { value: 'damerau', label: 'Damerau-Levenshtein (adjacent swaps)' },
        { value: 'jaro-winkler', label: 'Jaro-Winkler similarity' },
      ],
      default: 'levenshtein',
    },
    {
      key: 'reference',
      label: 'Reference text',
      type: 'textarea',
      default: '',
      placeholder: 'Compare every line against this text (defaults to the first line)',
    },
    {
      key: 'caseSensitive',
      label: 'Case sensitive',
      type: 'boolean',
      default: false,
    },
    {
      key: 'trimWhitespace',
      label: 'Trim whitespace',
      type: 'boolean',
      default: true,
    },
    {
      key: 'sort',
      label: 'Sort results',
      type: 'select',
      choices: [
        { value: 'score', label: 'Closest first' },
        { value: 'input', label: 'Input order' },
      ],
      default: 'score',
    },
    {
      key: 'limit',
      label: 'Max rows',
      type: 'number',
      default: 200,
      min: 1,
      max: 5000,
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'table', label: 'Table' },
        { value: 'lines', label: 'Lines' },
      ],
      default: 'table',
    },
  ],
  examples: [
    {
      title: 'Find the closest typo',
      input: 'colour\ncolor\ncolur\ncolourful\nflavour',
    },
    {
      title: 'Treat a swap as one edit',
      input: 'recieve\nreceive\nbelieve',
      options: { metric: 'damerau' },
    },
    {
      title: 'Match names by shared prefix',
      input: 'martha\nmarhta\nmarcia',
      options: { metric: 'jaro-winkler' },
    },
  ],
  article: [
    {
      heading: 'Scoring lines against a reference',
      body: 'Paste any number of lines and each one is compared to a reference, which defaults to the first line unless you fill in the reference field. Every row reports the edit distance, a similarity percentage, and how many characters the start and end share. Choosing lines instead of table output gives compact score d= distance rows.',
    },
    {
      heading: 'Picking the right metric',
      body: 'Levenshtein counts insertions, deletions and substitutions. Damerau-Levenshtein also treats one adjacent swap as a single edit, so teh and the stay close together. Jaro-Winkler returns a score from 0 to 1 that rewards a shared opening, which suits matching personal names and records.',
    },
    {
      heading: 'Options that change the ranking',
      body: 'Case sensitive is off by default and trim whitespace removes blank lines before comparison. Sort results orders either closest first or in the original input order, and max rows caps the table at 200 lines by default, adjustable up to 5000.',
    },
    {
      heading: 'Size ceilings and code points',
      body: 'Input is limited to 200000 characters and 5000 lines. The distance metrics fill a quadratic table, so long pairs are refused once the longer string approaches 2000 characters. Text is compared by code point, so an emoji counts as one unit rather than two.',
    },
    {
      heading: 'Comparison stays in the browser',
      body: 'Everything runs on the text you type, locally. No line is uploaded, no request leaves the page, and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What is edit distance?',
      a: 'The number of single-character insertions, deletions or substitutions needed to turn one string into the other. A distance of 0 means the strings are identical.',
    },
    {
      q: 'Which metric should I use?',
      a: 'Levenshtein for typos, Damerau-Levenshtein when a swapped pair such as "teh" versus "the" should count as one edit instead of two, and Jaro-Winkler when matching names or records where a shared prefix is a strong signal.',
    },
    {
      q: 'How is the similarity percentage calculated?',
      a: 'For the two distance metrics it is 1 minus distance divided by the length of the longer string, as a percentage. Jaro-Winkler produces its own score between 0 and 1, so no separate distance is shown.',
    },
    {
      q: 'Does it count emoji as one character?',
      a: 'Yes. Text is compared code point by code point, so an astral character such as an emoji counts as a single unit rather than two UTF-16 code units.',
    },
  ],
  related: ['diff-text', 'duplicate-line-finder', 'text-stats', 'char-frequency'],
  status: 'stable',
};
