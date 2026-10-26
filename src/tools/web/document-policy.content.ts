/**
 * Editorial content for the document-policy tool page.
 *
 * Kept out of ``document-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building a policy line',
      body: 'Build mode turns a comma-separated directive list into the Document-Policy header value. Every directive must use parenthesized policy syntax, and an empty list or any malformed entry stops the build with a clear error instead of emitting a broken header.',
    },
    {
      heading: 'Reading pasted directives',
      body: 'Analyze mode splits the header on commas while keeping quoted values intact, then lists each directive name, its value and a status. It catches invalid tokens, duplicate directives, values that are not parenthesized, and numeric thresholds above 1000 as unusually high.',
    },
    {
      heading: 'A sensible moment to use it',
      body: 'Reach for it when auditing a site that already sends Document-Policy, or when drafting an unload or sync-xhr opt-out to try in a staging environment before it reaches production.',
    },
    {
      heading: 'Support varies, so test first',
      body: 'Directive semantics and browser support differ, so a header that looks valid here may be ignored or enforced differently elsewhere. Validate the affected code before enforcing a policy, since it can change page behaviour.',
    },
    {
      heading: 'Analyzed on-device',
      body: 'Directives are parsed and generated inside the browser. Nothing is uploaded and no network request is made.',
    },
  ],
  faq: [
    {
      q: 'What does Document-Policy control?',
      a: 'It lets a document opt into or restrict browser behaviors and performance-related features, depending on browser support and the directive.',
    },
    {
      q: 'Is it the same as Permissions-Policy?',
      a: 'No. Permissions-Policy governs powerful feature access and delegation; Document-Policy governs document behavior and performance controls.',
    },
    {
      q: 'Should I deploy it immediately?',
      a: 'Roll out carefully, validate browser support, and test affected code because enforcing a policy can change page behavior.',
    },
  ],
} as const;
