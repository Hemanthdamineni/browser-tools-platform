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
    { key: 'count', label: 'How many', type: 'number', default: 1, min: 1, max: 200 },
    { key: 'monotonic', label: 'Monotonic (strictly increasing)', type: 'boolean', default: false },
    { key: 'lowercase', label: 'Lowercase', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'One ULID', options: { count: 1 } },
    { title: '10 monotonic ULIDs', options: { count: 10, monotonic: true } },
    { title: '200 lowercase ULIDs for a bulk import', options: { count: 200, lowercase: true } },
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
    {
      q: 'How do I read the creation time back out of a ULID?',
      a: 'The first ten characters are the 48-bit millisecond timestamp encoded in Crockford base32; decode them and you get Unix milliseconds. The stats panel does this for you and shows the first generated id as a UTC timestamp.',
    },
  ],
  article: [
    {
      heading: 'What a ULID is made of',
      body: 'A ULID is a 26-character identifier split into two parts: ten characters carrying a 48-bit millisecond timestamp and sixteen carrying 80 bits of randomness, all written in Crockford base32 — an alphabet that leaves out the letters I, L, O and U so the digit 0 and letter O cannot be confused. Because the timestamp comes first and base32 is lexicographically ordered, sorting a list of ULIDs as plain strings sorts them by creation time, without a database sequence or a coordination step.',
    },
    {
      heading: 'Generating one or a batch',
      body: 'The count option generates between one and two hundred ids in a single run, clamped to that range, and returns them newline-separated in ulids.txt. Lowercase mode converts the output alphabet for systems that treat identifiers case-insensitively. When several ids come out in the same millisecond the random part is incremented rather than re-rolled, so a batch produced in one click stays in ascending order instead of relying on the comparison being stable.',
    },
    {
      heading: 'Timestamps, ordering and sharing',
      body: 'The stats report the first generated id decoded back to a UTC timestamp, which is a quick way to confirm the clock the ids came from. That same property is worth remembering when a ULID is exposed: the creation time is readable by anyone who has the id, so do not use one where the time of creation is sensitive. The tail is filled from crypto.getRandomValues, so guessing the remainder of an id from its neighbours is not feasible.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Uniqueness rests on the 80 random bits rather than on any registry, so two ULIDs minted on different machines are distinct with overwhelming probability but the order between hosts still follows their clocks — a machine whose clock is behind can emit a lexicographically earlier id. Identifiers are produced entirely in your browser with the Web Crypto random source, and nothing is requested from a server, so a batch you generate is never logged anywhere but your own tab.',
    },
  ],
  related: ['uuid', 'nanoid', 'snowflake'],
  status: 'stable',
};
