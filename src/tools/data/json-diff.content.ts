/**
 * Editorial content for the json-diff tool page.
 *
 * Kept out of ``json-diff.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the diff is built',
      body: 'The editor holds document A and the Second JSON box holds document B; both must parse as strict JSON. The tool walks the two trees together and prints one line per difference with a path starting at $ that uses dotted keys and bracketed indexes: a minus line for a value only in A, a plus line for one only in B, and both when a scalar changed.',
    },
    {
      heading: 'When to reach for it',
      body: 'Compare a saved config against what a service returned, check whether an API response changed after a deploy, or confirm two environments are in sync. The path on each line points straight at where the documents diverge, which beats eyeballing two long files side by side.',
    },
    {
      heading: 'Array comparison modes',
      body: 'By default arrays compare index by index, so one insertion near the front makes every later element look changed. With Ignore array order on they are treated as multisets: elements present in both sides in equal counts are skipped wherever they sit, and leftovers are reported under a wildcard path such as tags[*].',
    },
    {
      heading: 'Caveats and privacy',
      body: 'A changed scalar prints as both a minus and a plus line for the same path and counts once as changed, while a key on only one side prints one line and counts as added or removed. An empty first input yields no output, and a blank second box is treated as an empty object. Both documents are parsed in the page, so nothing is sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'What do the +/- lines mean?',
      a: 'A line starting with - is the value only in A (removed); a line starting with + is the value only in B (added). A changed value shows both a - and a + line for the same path.',
    },
    {
      q: 'How does "ignore array order" work?',
      a: 'Arrays are compared as multisets: an element present in both sides in equal counts is treated as unchanged regardless of position. Otherwise arrays are compared index by index.',
    },
    {
      q: 'Why does a changed value print as two lines?',
      a: 'The output lists leaves: a scalar that differs appears once as removed from A and once as added to B on the same path, and the stats count it once as changed. A key that exists on only one side prints a single line and counts as added or removed instead.',
    },
  ],
} as const;
