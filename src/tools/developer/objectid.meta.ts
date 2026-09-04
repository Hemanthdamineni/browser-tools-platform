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
  faq: [
    {
      q: 'What do the 12 bytes mean?',
      a: 'Bytes 0-3 are a big-endian Unix timestamp in seconds, bytes 4-8 are a random value fixed per process, and bytes 9-11 are a counter that increments for each id.',
    },
    {
      q: 'Is the generated id the same as the MongoDB driver would make?',
      a: 'It has the same structure and a valid timestamp. The random and counter bytes come from crypto.getRandomValues rather than a persistent per-process seed.',
    },
  ],
  related: ['snowflake', 'uuid', 'uuid-namespace', 'unix-time'],
  status: 'stable',
};
