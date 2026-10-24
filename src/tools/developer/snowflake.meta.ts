import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'snowflake',
  name: 'Snowflake ID Decoder',
  category: 'developer',
  summary: 'Decode a 64-bit Snowflake ID into its timestamp, worker, process and sequence parts.',
  description:
    'Break a Twitter / Discord / Instagram Snowflake ID into the millisecond timestamp, worker and process ids, and per-millisecond sequence it packs. Pick a known epoch or supply your own.',
  keywords: [
    'snowflake',
    'snowflake id',
    'discord id',
    'twitter id',
    'instagram id',
    'decode',
    'timestamp',
    'distributed id',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'epoch',
      label: 'Epoch',
      type: 'select',
      default: 'discord',
      choices: [
        { value: 'twitter', label: 'Twitter / X (1288834974657)' },
        { value: 'discord', label: 'Discord (1420070400000)' },
        { value: 'instagram', label: 'Instagram (1314220021721)' },
        { value: 'custom', label: 'Custom…' },
      ],
    },
    {
      key: 'customEpoch',
      label: 'Custom epoch (ms since Unix epoch)',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'epoch', value: 'custom' },
    },
  ],
  examples: [
    {
      title: 'Decode a Discord ID',
      input: '175928847299117063',
      options: { epoch: 'discord' },
    },
    {
      title: 'Decode with the Twitter epoch',
      input: '1541815603606036480',
      options: { epoch: 'twitter' },
    },
    {
      title: 'Custom epoch (raw millis)',
      input: '4194304',
      options: { epoch: 'custom', customEpoch: 0 },
    },
  ],
  article: [
    {
      heading: 'What it does',
      body: 'Feed in one decimal Snowflake id and the result is a two-column table of fields against values: the creation time as an ISO UTC string, the same instant in Unix milliseconds, milliseconds since the service epoch, the 5-bit worker id, the 5-bit process id, the combined 10-bit machine id, the 12-bit sequence, and the raw 64-bit value in binary. The stats strip repeats the chosen epoch and the bit widths.',
    },
    {
      heading: 'When to use it',
      body: 'Useful when you need the creation time hidden inside a Discord message id, or when a Snowflake generator you run suddenly issues duplicates and you want to confirm which worker and sequence a suspicious id came from.',
    },
    {
      heading: 'Choosing the epoch',
      body: 'The epoch option offers Twitter, Discord and Instagram presets, each using the service own millisecond origin. Picking Custom reveals a second number field for any other origin; the stored time is added to that value, so simply reading the top 42 bits is not enough.',
    },
    {
      heading: 'Limits and pitfalls',
      body: 'Only digits are accepted, so strip any mention syntax such as a leading angle bracket and at-sign first. Values must fit in 64 bits. The bit split is fixed at 42/5/5/12, so an id from a service using a different layout will decode into plausible but wrong numbers, and the date can fall outside the representable range.',
    },
    {
      heading: 'Privacy',
      body: 'Decoding is plain BigInt arithmetic in the page, so ids are never sent anywhere and the tool runs offline. That suits investigating ids that belong to private conversations or accounts.',
    },
  ],
  faq: [
    {
      q: 'What is the bit layout?',
      a: 'From the top: 42 bits of millisecond timestamp, then 5 bits worker id, 5 bits process id, and 12 bits sequence. Twitter uses a single 10-bit machine id over the same two 5-bit fields.',
    },
    {
      q: 'Why do I need to pick an epoch?',
      a: 'The stored timestamp is milliseconds since a service-specific epoch, not the Unix epoch. Choosing the wrong one shifts every decoded date.',
    },
    {
      q: 'How do I read the binary row?',
      a: 'It is the 64-bit value padded to 64 characters and grouped as 42, 5, 5 and 12 bits, so the field boundaries are visible at a glance.',
    },
  ],
  related: ['objectid', 'uuid', 'uuid-namespace', 'timestamp'],
  status: 'stable',
};
