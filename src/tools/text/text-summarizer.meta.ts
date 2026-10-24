import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-summarizer',
  name: 'Text Summarizer',
  category: 'text',
  summary: 'Extract the most important sentences from a long document to make a quick summary.',
  description:
    'Condense a long piece of text into the N most representative sentences using an extractive algorithm: each sentence is scored by how often its meaningful words appear across the document (a simple TF-IDF-style measure), and the top sentences are returned in their original order. Stop-words, punctuation and word-length filters keep the ranking meaningful, and a clauses-per-sentence smoothing step avoids over-selecting from long run-on sentences. Everything runs on-device with no uploads and no ML dependency.',
  keywords: [
    'summarize',
    'text summary',
    'extractive summarization',
    'sentence ranking',
    'key sentences',
    'abstract',
    'important sentences',
    'condense text',
    'document summarizer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'length',
      label: 'Summary length',
      type: 'select',
      default: 'medium',
      choices: [
        { value: 'short', label: 'Short — ~15% of sentences' },
        { value: 'medium', label: 'Medium — ~30% of sentences' },
        { value: 'long', label: 'Long — ~45% of sentences' },
        { value: 'custom', label: 'Custom sentence count' },
      ],
    },
    { key: 'count', label: 'Sentence count', type: 'number', default: 5, min: 1, max: 25, step: 1 },
  ],
  examples: [
    {
      title: 'Summarize a paragraph',
      input:
        'Natural language processing is a field of computer science focused on enabling computers to understand and generate human language. NLP powers many everyday tools including search engines, spell checkers, machine translation and digital assistants. A key practical application is automatic text summarization, which extracts the most important sentences from a long document. Summaries help readers quickly grasp the main idea without reading everything. Extractive methods score sentences by word frequency to pick the best candidates.',
      options: { length: 'short' },
    },
    {
      title: 'A fixed number of sentences',
      input:
        'Version control keeps a full history of a project. Each commit records what changed and who changed it. Branches let you try an idea without disturbing the main line. Merging brings that work back when it is ready. A good history makes it possible to find when a bug was introduced.',
      options: { length: 'custom', count: 2 },
    },
    {
      title: 'A longer extract',
      input:
        'Caching reduces the work a server must do for repeated requests. A cache stores the result of an expensive operation so the next caller can read it instead of recomputing it. The trade-off is freshness, because a cached value may be stale. Choosing a short time to live limits how stale the value can become. An eviction policy decides what to drop when the cache is full.',
      options: { length: 'long' },
    },
  ],
  article: [
    {
      heading: 'Extractive, not generative',
      body: 'The tool picks whole sentences out of your text; it does not rewrite them. That distinction matters: nothing is paraphrased and nothing is invented, so a summary can be checked against the source and no fact can be fabricated. The output is a set of the most representative sentences, in the order they originally appeared.',
    },
    {
      heading: 'How a sentence earns its place',
      body: 'Each sentence is scored by how often its content words appear across the whole document — a simple term-frequency measure. Words shorter than three characters and a long stop-word list are ignored so that "the" and "and" carry no weight. A smoothing step accounts for how many clauses a sentence contains, which stops one enormous run-on sentence from crowding out the shorter, denser ones.',
    },
    {
      heading: 'Choosing a length',
      body: 'Short takes roughly 15% of the sentences, medium about 30% and long about 45%. Documents of two sentences or fewer always yield a single summary sentence. Custom lets you name an exact count from 1 to 25, which is the option to use when you need, say, a three-sentence abstract for a fixed slot rather than a proportion.',
    },
    {
      heading: 'Where it will not help',
      body: 'Text under ten words is refused, because there is nothing to rank. A single short paragraph comes back essentially unchanged — an extractive summarizer has no way to compress below one sentence without rewriting. Multi-paragraph prose, transcripts and long documentation are where the frequency scoring has enough signal to separate the central points from the detail.',
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
  related: ['text-stats', 'word-frequency', 'char-frequency'],
  status: 'stable',
};
