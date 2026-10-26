/**
 * Editorial content for the text-summarizer tool page.
 *
 * Kept out of ``text-summarizer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Extractive, not generative',
      body: 'The tool picks whole sentences out of your text; it does not rewrite them. That distinction matters: nothing is paraphrased and nothing is invented, so a summary can be checked against the source and no fact can be fabricated. The output is the most representative sentences, in the order they originally appeared.',
    },
    {
      heading: 'How a sentence earns its place',
      body: 'Each sentence is scored by how often its content words appear across the document — a simple term-frequency measure. Words shorter than three characters and a long stop-word list are ignored so "the" and "and" carry no weight. A smoothing step accounts for how many clauses a sentence contains, which stops one huge run-on sentence from crowding out shorter, denser ones.',
    },
    {
      heading: 'Choosing a length',
      body: 'Short takes roughly 15% of the sentences, medium about 30% and long about 45%. Documents of two sentences or fewer always yield a single summary sentence. Custom lets you name an exact count from 1 to 25, for when you need a fixed three-sentence abstract rather than a proportion.',
    },
    {
      heading: 'Where it will not help',
      body: 'Text under ten words is refused, because there is nothing to rank. A single short paragraph comes back essentially unchanged — an extractive summarizer cannot compress below one sentence without rewriting. Multi-paragraph prose, transcripts and long documentation are where the frequency scoring has enough signal to separate central points from detail.',
    },
    {
      heading: 'Your document is not uploaded',
      body: 'Tokenising, scoring and selecting all run inside this tab with no machine-learning service and no network call. A confidential report can be summarised without it leaving your machine, and the tool works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'How does the summarizer decide which sentences matter?',
      a: 'It scores each sentence by the average frequency of its content words (words that are not stop-words). Words that appear often across the document push their source sentences up, and the top-ranked sentences are returned in their original order.',
    },
    {
      q: 'Is my text uploaded anywhere?',
      a: 'No. The whole process — tokenising, scoring and selecting — happens inside your browser tab, so even confidential documents never leave your machine.',
    },
    {
      q: 'Are the chosen sentences reordered?',
      a: 'No. The top sentences are emitted in the order they appear in the original text so the summary reads naturally.',
    },
    {
      q: 'Will short paragraphs drop out?',
      a: 'This is an extractive summarizer — it selects whole sentences from the input. Multi-paragraph documents work well; a single short paragraph shrinks to the same paragraph rather than a rewrite.',
    },
  ],
} as const;
