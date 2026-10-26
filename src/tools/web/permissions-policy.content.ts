/**
 * Editorial content for the permissions-policy tool page.
 *
 * Kept out of ``permissions-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Turning capability policy into a table',
      body: 'Paste comma-separated directives such as camera=(self "https://video.example"), geolocation=() and the analyser splits them into a table of feature, allowlist and status. Empty parentheses show as (empty) and are counted as disabled. Build mode takes one feature name and a space-separated allowlist and assembles the directive.',
    },
    {
      heading: 'Locking a page down before an embed',
      body: 'Reach for this when a page embeds third-party frames and you need to be sure only the intended origins may reach the camera, microphone or geolocation, or when a feature should be off for the document entirely.',
    },
    {
      heading: 'Origins, none and the wildcard',
      body: 'An allowlist accepts self, an explicit https origin in quotes, the * wildcard or none. The analyser flags * as a broad grant worth reviewing, rejects none combined with another origin, and reports duplicate feature directives and malformed allowlist tokens.',
    },
    {
      heading: 'Feature names and browser support',
      body: 'Feature names use lowercase letters, digits and hyphens, and a directive can be grammatically valid while a browser ignores a feature it does not implement, so test the browsers you actually ship to.',
    },
    {
      heading: 'Analysed without leaving the browser',
      body: 'Both the parser and the builder are page code, so the policy you paste, internal hostnames included, is never uploaded and the tool keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What does Permissions-Policy control?',
      a: 'It controls whether browser features such as camera, microphone, geolocation, or fullscreen may be used by a document and delegated frames.',
    },
    {
      q: 'What does an empty allowlist mean?',
      a: 'An empty list, written (), disables that feature for the document and its frames.',
    },
    {
      q: 'Is this the old Feature-Policy header?',
      a: 'Permissions-Policy is the current header name. Browser support and feature names evolve, so test the target browsers.',
    },
  ],
} as const;
