/**
 * Editorial content for the uuid-namespace tool page.
 *
 * Kept out of ``uuid-namespace.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A UUID that is a pure function of its inputs',
      body: 'A name-based (version 3 or 5) UUID is computed by hashing a namespace UUID together with the name you type, so the same namespace and name always produce the same identifier, on any machine, every time. It is fully deterministic — the opposite of a random v4. Use it where a stable, collision-free key must be derivable from a label, such as mapping a resource path to an id that must not change when the resource moves.',
    },
    {
      heading: 'v5 versus v3',
      body: 'v5 hashes the namespace and name with SHA-1; v3 uses MD5. Prefer v5 — SHA-1 is the stronger of the two and the modern default — and choose v3 only to match a system that already emits MD5-based ids you must reproduce byte for byte. The version and variant bits are set on the digest so the result is always a well-formed RFC 4122 UUID.',
    },
    {
      heading: 'The standard namespaces',
      body: 'The four predefined namespaces are fixed UUIDs from RFC 4122 that share one suffix: DNS 6ba7b810-…, URL 6ba7b811-…, OID 6ba7b812-… and X.500 6ba7b814-…. The DNS namespace is the usual starting point for names that are hostnames or fully-qualified labels; pick URL when the name is an address. For anything else, choose Custom UUID and paste your own 8-4-4-4-12 namespace.',
    },
    {
      heading: 'Deterministic and private',
      body: 'The output depends only on the namespace and name — there is no randomness and no clock, so the same input always reproduces the same UUID and results are stable across machines and versions. The hashing is done in the page with the browser’s SHA-1 or an in-page MD5 implementation, so the namespace and name you enter never leave your device.',
    },
  ],
  faq: [
    {
      q: 'Which version should I use?',
      a: 'Prefer v5. It uses SHA-1, which is stronger than the MD5 used by v3. Use v3 only for compatibility with a system that already produces it.',
    },
    {
      q: 'Are these random?',
      a: 'No. Name-based UUIDs are fully deterministic — the same namespace and name always produce the same UUID, on any machine.',
    },
    {
      q: 'What are the standard namespaces?',
      a: 'RFC 4122 defines DNS 6ba7b810-9dad-11d1-80b4-00c04fd430c8, URL 6ba7b811-…, OID 6ba7b812-… and X.500 6ba7b814-… (all sharing the same suffix).',
    },
  ],
} as const;
