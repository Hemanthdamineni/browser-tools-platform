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
  ],
  faq: [
    {
      q: 'What is the difference between ULID and UUID v7?',
      a: 'Both embed a timestamp, but ULID uses Crockford base32 (no I, L, O, U) with a fixed 26-character layout, making it shorter and typo-resistant when read aloud.',
    },
    {
      q: 'What does monotonic mode do?',
      a: 'When two ULIDs are generated in the same millisecond, monotonic mode increments the random part by one instead of re-rolling, so ids generated in the same ms are still strictly ordered.',
    },
  ],
  related: [  "uuid",
  "nanoid",
  "snowflake"],
  status: 'stable',
};
