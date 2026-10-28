import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ulid',
  name: 'ULID Generator',
  category: 'generators',
  summary: 'Generate sortable ULIDs (timestamp + randomness) in Crockford base32.',
  description:
    'Create ULIDs — 26-character ids that embed a millisecond timestamp followed by 80 random bits, so they sort chronologically. Monotonic mode increments within the same millisecond.',
  keywords: [
    'ulid',
    'unique id',
    'sortable id',
    'identifier',
    'crockford base32',
    'timestamp id',
    'monotonic',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1 },
    { key: 'monotonic', label: 'Monotonic (strictly increasing)', type: 'boolean', default: false },
    { key: 'lowercase', label: 'Lowercase', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'One ULID', options: { count: 1 } },
    { title: '10 monotonic ULIDs', options: { count: 10, monotonic: true } },
    { title: '200 lowercase ULIDs for a bulk import', options: { count: 200, lowercase: true } },
  ],
  related: ['uuid', 'nanoid', 'snowflake'],
  status: 'stable',
};
