import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-summarizer',
  name: 'Text Summarizer',
  category: 'text',
  summary: 'Extract the most important sentences from a long document to make a quick summary.',
  description: 'Condense a long piece of text into the N most representative sentences using an extractive algorithm: each sentence is scored by how often its meaningful words appear across the document (a simple TF-IDF-style measure), and the top sentences are returned in their original order. Stop-words, punctuation and word-length filters keep the ranking meaningful, and a clauses-per-sentence smoothing step avoids over-selecting from long run-on sentences. Everything runs on-device with no uploads and no ML dependency.',
  keywords: ['summarize', 'text summary', 'extractive summarization', 'sentence ranking', 'key sentences', 'abstract', 'important sentences', 'condense text', 'document summarizer'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'length', label: 'Summary length', type: 'select', default: 'medium', choices: [{ value: 'short', label: 'Short — ~15% of sentences' }, { value: 'medium', label: 'Medium — ~30% of sentences' }, { value: 'long', label: 'Long — ~45% of sentences' }, { value: 'custom', label: 'Custom sentence count' }] },
    { key: 'count', label: 'Sentence count', type: 'number', default: 5, min: 1, max: 25, step: 1 },
  ],
  examples: [
    { title: 'Summarize a paragraph', input: 'Natural language processing is a field of computer science focused on enabling computers to understand and generate human language. NLP powers many everyday tools including search engines, spell checkers, machine translation and digital assistants. A key practical application is automatic text summarization, which extracts the most important sentences from a long document. Summaries help readers quickly grasp the main idea without reading everything. Extractive methods score sentences by word frequency to pick the best candidates.', options: { length: 'short' } },
  ],
  faq: [
    { q: 'How does the summarizer decide which sentences matter?', a: 'It scores each sentence by the average frequency of its content words (words that are not stop-words). Words that appear often across the document push their source sentences up, and the top-ranked sentences are returned in their original order.' },
    { q: 'Is my text uploaded anywhere?', a: 'No. The whole process — tokenising, scoring and selecting — happens inside your browser tab, so even confidential documents never leave your machine.' },
    { q: 'Are the chosen sentences reordered?', a: 'No. The top sentences are emitted in the order they appear in the original text so the summary reads naturally.' },
    { q: 'Will short paragraphs drop out?', a: 'This is an extractive summarizer — it selects whole sentences from the input. Multi-paragraph documents work well; a single short paragraph shrinks to the same paragraph rather than a rewrite.' },
  ],
  related: ['text-stats', 'word-frequency', 'char-frequency'],
  status: 'stable',
};
