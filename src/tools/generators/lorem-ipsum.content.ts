/**
 * Editorial content for the lorem-ipsum tool page.
 *
 * Kept out of ``lorem-ipsum.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Choosing the unit and count',
      body: 'Pick how much copy you need from the unit dropdown — paragraphs, sentences, words or list items — and set the count from 1 to 200. The generator builds each unit from a shared word list, so a paragraph is a handful of sentences and a sentence is roughly eight to fifteen words. With the count at its maximum you get a long block suitable for a full-page mockup.',
    },
    {
      heading: 'The classic opening',
      body: 'With Start with “Lorem ipsum dolor sit amet…” on, the very first paragraph or sentence begins with the traditional eight words and the rest of the text is randomized around them. It is off by default only when the count is small; the option guarantees a familiar first line for a placeholder.',
    },
    {
      heading: 'The output formats',
      body: 'Plain text is ready for any editor. HTML wraps paragraphs in <p> tags, or list items in a <ul> with <li> children, so a mockup can paste it into a template directly. Markdown emits blank-line-separated paragraphs or hyphen-prefixed list items, which reads cleanly in a README or issue body.',
    },
    {
      heading: 'Random, but generated in your tab',
      body: 'Each run is randomized with crypto.getRandomValues, so consecutive clicks give different filler — it is not the same canned text every time. The generation is pure string work in the page, makes no network request and uploads nothing, so placeholder copy is produced instantly even offline.',
    },
  ],
  faq: [
    {
      q: 'What is lorem ipsum?',
      a: 'A scrambled excerpt from Cicero’s “De finibus” (45 BC), used as neutral placeholder copy in typesetting and design since the 1500s.',
    },
    {
      q: 'Is the text identical every time?',
      a: 'No — beyond the optional “Lorem ipsum dolor sit amet…” opening, the word order and sentence lengths are randomized each run.',
    },
    {
      q: 'What does the output look like in each format?',
      a: 'Plain text joins paragraphs with a blank line and list items with a newline. HTML wraps paragraphs in <p> tags or list items in a <ul> with <li> children. Markdown uses blank lines between paragraphs and hyphens for list items, so it can be pasted straight into a README.',
    },
  ],
} as const;
