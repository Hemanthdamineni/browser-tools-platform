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
  related: ['objectid', 'uuid', 'uuid-namespace', 'timestamp'],
  status: 'stable',
};
