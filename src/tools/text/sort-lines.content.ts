/**
 * Editorial content for the sort-lines tool page.
 *
 * Kept out of ``sort-lines.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reordering a list, five ways',
      body: 'Paste one item per line and the tool reorders them. Alphabetical uses a locale-aware collator, Natural compares embedded numbers by value so file2 comes before file10, Numeric sorts by the leading number, Line length sorts shortest to longest, and Shuffle reorders randomly. Direction flips ascending to descending.',
    },
    {
      heading: 'Tidying a file or a pasted block',
      body: 'Use it to sort an imports list, to order hostnames or addresses, to alphabetise a glossary, or to shuffle names into a random order for drawing lots. Combined with Remove duplicate lines and Trim each line first it becomes a one-pass cleanup for a messy paste.',
    },
    {
      heading: 'Options that change the comparison',
      body: 'Method picks the comparison and Direction flips it. Case sensitive switches the collator between base and variant sensitivity, so A and a compare equal when off. Remove duplicate lines dedupes after the cleanups, Trim each line first strips whitespace, and Remove blank lines drops empty rows — all run before the sort.',
    },
    {
      heading: 'Caveats',
      body: 'Shuffle is seeded from the input text, so the same list shuffled twice gives the same order, and Direction is ignored in shuffle mode. Numeric sort pushes lines without a leading number to the end. A collator sorts by language rules rather than raw code points, so punctuation and accents can surprise you if you expected ASCII order.',
    },
    {
      heading: 'Sorted in the browser',
      body: 'The whole list is reordered in your tab and never uploaded, which is what you want for email addresses, hostnames or names. It keeps working with no connection.',
    },
  ],
  faq: [
    {
      q: 'What is a natural sort?',
      a: 'Numbers inside the text are compared by value, not character by character, so "item2" sorts before "item10". Standard alphabetical sort would put "item10" first.',
    },
    {
      q: 'Why does shuffling give the same order every time?',
      a: 'The shuffle is seeded from the input text so the result is reproducible rather than flickering on every keystroke. Change a character, or shuffle different input, to get a different arrangement.',
    },
    {
      q: 'What does case sensitivity actually change?',
      a: 'It selects the collator sensitivity. With case sensitivity off (base sensitivity) Apple and apple compare equal and their relative order is stable; with it on (variant sensitivity) upper and lower case are distinguished.',
    },
  ],
} as const;
