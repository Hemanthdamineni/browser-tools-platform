import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sort-lines',
  name: 'Sort Lines',
  category: 'text',
  summary: 'Sort lines alphabetically, numerically, by length, naturally, or shuffle them.',
  description:
    'Reorder the lines of a list. Choose the comparison, direction and case sensitivity, and optionally remove duplicates or blank lines in the same pass.',
  keywords: ['sort lines', 'alphabetical', 'natural sort', 'order list', 'shuffle', 'sort text'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'method',
      label: 'Sort by',
      type: 'select',
      default: 'alpha',
      choices: [
        { value: 'alpha', label: 'Alphabetical' },
        { value: 'natural', label: 'Natural (file2 before file10)' },
        { value: 'numeric', label: 'Numeric (leading number)' },
        { value: 'length', label: 'Line length' },
        { value: 'shuffle', label: 'Shuffle (random)' },
      ],
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      default: 'asc',
      choices: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
    },
    { key: 'caseSensitive', label: 'Case sensitive', type: 'boolean', default: false },
    { key: 'unique', label: 'Remove duplicate lines', type: 'boolean', default: false },
    { key: 'removeBlank', label: 'Remove blank lines', type: 'boolean', default: false },
    { key: 'trim', label: 'Trim each line first', type: 'boolean', default: false },
  ],
  article: [
    {
      heading: 'Reordering a list, five ways',
      body: 'Paste one item per line and the tool reorders them. Alphabetical uses a locale-aware collator, Natural compares embedded numbers by value so file2 comes before file10, Numeric sorts by the leading number, Line length sorts shortest to longest, and Shuffle reorders randomly. Direction flips ascending to descending, and the output keeps one item per line.',
    },
    {
      heading: 'Tidying a file or a pasted block',
      body: 'Use it to sort an imports list, to order a set of hostnames or addresses, to alphabetise a glossary, or to shuffle names into a random order for drawing lots. Combined with Remove duplicate lines and Trim each line first it becomes a one-pass cleanup for a messy paste.',
    },
    {
      heading: 'Options that change the comparison',
      body: 'Method picks the comparison above and Direction flips it. Case sensitive switches the collator between base and variant sensitivity, so A and a compare equal when it is off. Remove duplicate lines dedupes after the cleanups, Trim each line first strips surrounding whitespace, and Remove blank lines drops empty rows — all three cleanups run before the sort.',
    },
    {
      heading: 'Caveats',
      body: 'Shuffle is seeded from the input text, so the same list shuffled twice gives the same order; change a character or reload with different input to get a different arrangement, and Direction is ignored in shuffle mode. Numeric sort pushes lines that do not begin with a number to the end. A collator sorts by language rules rather than raw code points, so punctuation and accented letters can surprise you if you expected ASCII order.',
    },
    {
      heading: 'Sorted in the browser',
      body: 'The whole list is reordered in your tab and never uploaded, which is what you want for email addresses, hostnames or names. It keeps working with no connection.',
    },
  ],
  examples: [
    { title: 'Sort a list', input: 'banana\napple\ncherry' },
    { title: 'Natural sort', input: 'file10\nfile2\nfile1', options: { method: 'natural' } },
    {
      title: 'Sort by length and drop duplicates',
      input: 'cherry\napple\nbanana\napple',
      options: { method: 'length', unique: true, trim: true },
    },
  ],
  faq: [
    {
      q: 'What is a natural sort?',
      a: 'Numbers inside the text are compared by value, not character by character, so "item2" sorts before "item10". Standard alphabetical sort would put "item10" first.',
    },
    {
      q: 'Why does shuffling give the same order every time?',
      a: 'The shuffle is seeded from the input text so the result is reproducible rather than flickering on every keystroke. Change a character, or shuffle different input, to get a different arrangement.',
    },
    {
      q: 'What does case sensitivity actually change?',
      a: 'It selects the collator sensitivity. With case sensitivity off (base sensitivity) Apple and apple compare equal and their relative order is stable; with it on (variant sensitivity) upper and lower case are distinguished.',
    },
  ],
  related: ['dedupe-lines', 'reverse-text', 'remove-empty-lines'],
  status: 'stable',
};
