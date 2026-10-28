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
    { key: 'count', label: 'Sentence count', type: 'number', default: 5, min: 1, step: 1 },
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
  related: ['text-stats', 'word-frequency', 'char-frequency'],
  status: 'stable',
};
