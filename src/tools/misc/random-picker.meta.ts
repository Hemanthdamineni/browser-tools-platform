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
  related: ['random-string', 'random-data', 'sort-lines'],
  status: 'stable',
};
