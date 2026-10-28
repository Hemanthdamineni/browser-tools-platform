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
  related: ['diff-text', 'duplicate-line-finder', 'text-stats', 'char-frequency'],
  status: 'stable',
};
