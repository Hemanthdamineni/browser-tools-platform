import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'objectid',
  name: 'MongoDB ObjectId',
  category: 'developer',
  summary: 'Decode a 24-character MongoDB ObjectId into its timestamp, random and counter bytes.',
  description:
    'Split an ObjectId into the 4-byte creation timestamp, 5-byte per-process random value and 3-byte incrementing counter, or generate a fresh valid ObjectId from the current time.',
  keywords: [
    'objectid',
    'object id',
    'mongodb',
    'mongo',
    'bson',
    'decode',
    'generate',
    'timestamp',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'decode',
      choices: [
        { value: 'decode', label: 'Decode an ObjectId' },
        { value: 'generate', label: 'Generate a new ObjectId' },
      ],
    },
  ],
  examples: [
    {
      title: 'Decode an ObjectId',
      input: '507f1f77bcf86cd799439011',
      options: { mode: 'decode' },
    },
    {
      title: 'Decode a recent id',
      input: '65a1b2c3d4e5f60718293a4b',
      options: { mode: 'decode' },
    },
    {
      title: 'Generate a new ObjectId',
      options: { mode: 'generate' },
    },
  ],
  related: ['snowflake', 'uuid', 'uuid-namespace', 'timestamp'],
  status: 'stable',
};
