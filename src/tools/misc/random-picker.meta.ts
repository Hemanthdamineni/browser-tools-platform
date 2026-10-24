import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'random-picker',
  name: 'Random Picker / Shuffler',
  category: 'misc',
  summary: 'Pick random list items, shuffle an order or deal balanced teams.',
  description:
    'Paste a list with one item per line (or comma-separated values on one line), then pick entries, shuffle the list or deal balanced teams. Selection uses the browser cryptographic random number generator.',
  keywords: [
    'random picker',
    'pick a name',
    'shuffle',
    'random list',
    'team generator',
    'draw names',
    'lottery',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'pick',
      choices: [
        { value: 'pick', label: 'Pick random items' },
        { value: 'shuffle', label: 'Shuffle list' },
        { value: 'teams', label: 'Make teams' },
        { value: 'order', label: 'Random order' },
      ],
    },
    {
      key: 'pickCount',
      label: 'Number of items',
      type: 'number',
      default: 1,
      min: 1,
      max: 1000,
      showWhen: { key: 'mode', value: 'pick' },
    },
    {
      key: 'teamCount',
      label: 'Number of teams',
      type: 'number',
      default: 2,
      min: 2,
      max: 50,
      showWhen: { key: 'mode', value: 'teams' },
    },
    {
      key: 'allowDuplicates',
      label: 'Allow duplicate picks',
      type: 'boolean',
      default: false,
      showWhen: { key: 'mode', value: 'pick' },
    },
    { key: 'trimLines', label: 'Trim whitespace', type: 'boolean', default: true },
    { key: 'dropBlank', label: 'Drop blank entries', type: 'boolean', default: true },
  ],
  examples: [
    {
      title: 'Make two teams',
      input: 'Alex\nBlair\nCasey\nDrew',
      options: { mode: 'teams', teamCount: 2 },
    },
    {
      title: 'Draw a single winner',
      input: 'Ana\nBo\nCy',
      options: { mode: 'pick', pickCount: 1 },
    },
    {
      title: 'Random speaking order',
      input: 'Ari\nBea\nCal\nDot',
      options: { mode: 'order' },
    },
  ],
  faq: [
    {
      q: 'How are random entries chosen?',
      a: 'The browser cryptographic random number generator is used for each selection and shuffle step. Picks are without replacement by default.',
    },
    {
      q: 'Can one item be picked more than once?',
      a: 'Only if the allowDuplicates switch is on. Without it the picker refuses to draw more distinct items than the list holds, raising an error with the list length.',
    },
    {
      q: 'How are comma-separated values handled?',
      a: 'A single line is split on commas when it contains more than one value; multi-line input is split one item per line.',
    },
  ],
  article: [
    {
      heading: 'What the picker does',
      body: 'Paste items one per line or as comma-separated values, then pick random entries, shuffle the whole list, produce a random order, or deal balanced teams. Unbiased selection uses crypto.getRandomValues rejection sampling, and output is plain text except in team mode, which returns a table with Team and Members columns.',
    },
    {
      heading: 'When to use it',
      body: 'Draw a lottery winner from a participant list, assign random speaking orders, or split a class or squad into fair teams for a drill. Team mode fills groups round-robin from a shuffled deck so their sizes differ by at most one member.',
    },
    {
      heading: 'Options that steer the result',
      body: 'Mode chooses pick, shuffle, teams or order; pickCount and teamCount set how many are drawn; and allowDuplicates lets the same item appear more than once in pick mode. trimLines and dropBlank strip stray whitespace and empty rows before any selection.',
    },
    {
      heading: 'Limits and edge cases',
      body: 'An empty list raises an error, pickCount must lie between 1 and 1000, and distinct picks cannot exceed the list length unless duplicates are allowed. Team count must stay between 2 and 50.',
    },
    {
      heading: 'Randomness stays on-device',
      body: "The cryptographic random generator is your own browser's, and trimming, shuffling and dealing all happen locally, so nothing about your list or picks is uploaded.",
    },
  ],
  related: ['random-string', 'random-data', 'sort-lines'],
  status: 'stable',
};
