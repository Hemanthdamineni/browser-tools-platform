/**
 * Editorial content for the semver tool page.
 *
 * Kept out of ``semver.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What gets checked and printed',
      body: 'The input is a newline-separated list of version strings, each checked against strict SemVer 2.0.0: MAJOR.MINOR.PATCH with an optional -prerelease and +build part. Validate mode returns a three-column table of every line with Valid or Invalid and, when it fails, the expected shape.',
    },
    {
      heading: 'A release-day use',
      body: 'Before tagging a release, paste the candidate versions from your package manifests or CI matrix and confirm every one is well formed. In sort mode the same list comes back ordered by precedence, so you can see whether the new tag really sits after the last one.',
    },
    {
      heading: 'Modes and the two extra options',
      body: 'The mode select chooses validate, compare or sort. Compare takes exactly one version in the box and pairs it with the second version field, printing whether the first is less than, greater than or of equal precedence to the second. The descending toggle reverses the sort output.',
    },
    {
      heading: 'Strictness and build metadata',
      body: 'A leading v, surrounding whitespace inside the token or another prefix is rejected, and sort refuses to run if any line is invalid. Build metadata is ignored when comparing precedence but is kept in the displayed and sorted strings. A prerelease always sorts below the plain version.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'All parsing and comparison runs in your browser; no version string is uploaded and the page keeps working offline. That makes it safe for private version numbers that have not been published yet.',
    },
  ],
  faq: [
    {
      q: 'Does build metadata affect comparison?',
      a: 'No. SemVer 2.0.0 says build metadata is ignored for precedence. It is preserved in displayed and sorted values.',
    },
    {
      q: 'Are leading v prefixes accepted?',
      a: 'No. This tool validates strict SemVer 2.0.0. Remove a leading v, whitespace, or other tag prefix before checking.',
    },
    {
      q: 'How are prereleases ordered?',
      a: 'A version with a prerelease has lower precedence than the corresponding normal version. Numeric identifiers compare numerically, and numeric identifiers always precede non-numeric identifiers.',
    },
  ],
} as const;
