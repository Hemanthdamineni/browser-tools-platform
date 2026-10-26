/**
 * Editorial content for the conditional-request-headers tool page.
 *
 * Kept out of ``conditional-request-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building a full conditional-request set',
      body: 'Build mode generates any of the seven headers a conditional request can carry. Picking the target All emits every header that makes sense for a response and the request that follows it: an ETag or Last-Modified validator for the stored representation, then If-Match, If-None-Match, If-Range, If-Modified-Since and If-Unmodified-Since conditions built from that validator and the date. Each is produced in valid header syntax with correct quoting, so you can paste the block straight into a curl command or a test harness. Analyze mode takes the opposite direction and checks a pasted header block, and compare mode tells you whether two validators match.',
    },
    {
      heading: 'The choice of validator and its strength',
      body: 'A validator is either an entity-tag or a date, and the strength of an entity-tag decides which conditions may use it. A strong tag, "abc", can back If-Match, If-Range and If-None-Match; a weak tag, W/"abc", only satisfies If-None-Match because it only asserts that two representations are semantically equivalent. The weak toggle emits a W/ prefix, the wildcard option replaces the tag with * for If-Match or If-None-Match, and the If-Range validator pick selects between a strong tag and an HTTP date, since If-Range refuses a weak tag because a range must map to the exact bytes of one representation.',
    },
    {
      heading: 'How comparison decides a match',
      body: 'Compare mode checks two validators and reports whether they match under the comparison you choose. Weak comparison is what If-None-Match performs: it treats W/"abc" and "abc" as equal, because a weak tag is satisfied by any representation that is semantically the same. Strong comparison is what If-Match and If-Range require: both tags must be strong and their opaque values must match exactly. The request-method picker for If-None-Match matters because the conditional response differs by method — a GET or HEAD returns 304 Not Modified on a match, while a PUT would return 412 Precondition Failed.',
    },
    {
      heading: 'What it validates and where it runs',
      body: 'The analyzer enforces the RFC 7232 grammar rather than guessing: entity-tags must be quoted with a valid strength prefix, a date must be an IMF-fixdate such as Wed, 21 Oct 2015 07:28:00 GMT, and the wildcard is only allowed where the spec permits it. The result is generated and checked purely from the text you type — nothing is hashed, fetched or requested, and the header block you paste is never sent anywhere, so the tool works offline as a reference for debugging cache and precondition behaviour.',
    },
  ],
  faq: [
    {
      q: 'What is the difference between weak and strong comparison?',
      a: 'Weak comparison treats W/"abc" and "abc" as equivalent, so it is used by If-None-Match. Strong comparison requires both tags to be strong and their opaque values to match exactly, which If-Match and If-Range need.',
    },
    {
      q: 'Which headers can use the wildcard *?',
      a: 'Only If-Match and If-None-Match accept *; it matches any current representation. ETag and If-Range must name a specific validator.',
    },
    {
      q: 'Why does If-Range reject weak tags?',
      a: 'A Range must map to the exact bytes of one representation, so If-Range requires a strong validator — a strong entity-tag or an IMF-fixdate.',
    },
    {
      q: 'Does this hash or fetch anything?',
      a: 'No. It only generates and validates header text from what you type; nothing is hashed, uploaded or requested.',
    },
  ],
} as const;
