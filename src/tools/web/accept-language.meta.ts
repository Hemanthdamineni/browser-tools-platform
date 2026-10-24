import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-language',
  name: 'Accept-Language Header Analyzer',
  category: 'web',
  summary: 'Analyze and build Accept-Language values',
  description:
    'Analyze HTTP Accept-Language header values or rank a list of language tags. Validates BCP-47 language syntax and q-values, sorts by preference, flags duplicates and malformed weights, and reports which languages a client most prefers.',
  keywords: [
    'Accept-Language',
    'language negotiation',
    'language tag',
    'BCP 47',
    'q-value',
    'quality value',
    'RFC 5646',
    'HTTP language',
    'locale weighting',
    'content negotiation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze header' },
        { value: 'rank', label: 'Sort by preference' },
      ],
    },
    {
      key: 'defaultQuality',
      label: 'Default q (rank mode)',
      type: 'select',
      default: '1.0',
      choices: [
        { value: '1.0', label: '1.0' },
        { value: '0.9', label: '0.9' },
        { value: '0.5', label: '0.5' },
        { value: '0', label: '0 (not acceptable)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Analyze a browser header',
      input: 'Accept-Language: en-US, en;q=0.9, fr;q=0.7, *;q=0.5',
    },
    {
      title: 'Rank a comma-separated tag list',
      input: 'de, ja, es',
      options: { mode: 'rank', defaultQuality: '0.9' },
    },
    {
      title: 'Flag a bad q-value',
      input: 'Accept-Language: en;q=1.5, fr;q=0.5',
    },
  ],
  faq: [
    {
      q: 'How are q-values interpreted?',
      a: "A q-value (0 to 1) expresses a client's preference for that language, with 1.0 the strongest. Descending order of q-value is the preference order.",
    },
    {
      q: 'What is a valid language range?',
      a: 'Per BCP 47, tags like en (language), en-US (region) or zh-Hant (script) are valid. Wildcards (*) match any language.',
    },
    {
      q: 'What are common pitfalls?',
      a: 'q-values outside 0–1 are invalid; duplicate ranges should be combined; and a language with q=0 is explicitly unacceptable.',
    },
  ],
  article: [
    {
      heading: 'What the Accept-Language analyzer does',
      body: 'Paste a header and the tool validates each language range against BCP-47 syntax, reads the q-value weight, flags duplicates and malformed entries, and sorts the whole list by preference. It reports the top language and a preference-ordered summary, so you can see exactly what a client is asking for.',
    },
    {
      heading: 'Debugging content negotiation',
      body: 'Use it when a site serves the wrong language or a negotiation bug shows up. Pasting the real header shows whether the client sent a usable q-value, whether a typo made a range invalid, and which language should actually win, before you blame the server config.',
    },
    {
      heading: 'Analyze versus rank',
      body: 'Analyze mode reads the q-values from the pasted header and sorts by them. Rank mode ignores the incoming weights, assigns your chosen default q to every range and orders the list, which is handy when you want to model how a specific preference would resolve. Default quality 0 marks a language unacceptable.',
    },
    {
      heading: 'What gets flagged',
      body: 'The tool rejects q-values outside 0 to 1, calls out duplicate ranges that should be combined, and marks ranges that are not valid BCP-47 tags. A bare wildcard is allowed and sorts by its weight, since it means any language. Only the header value matters here, not full request semantics.',
    },
    {
      heading: 'The header stays on your device',
      body: 'Parsing and ranking run entirely in the browser, with no upload and no network call. A pasted header from a real session, which can be a sensitive fingerprint, is processed offline and never leaves your machine.',
    },
  ],
  related: ['content-language', 'cache-headers', 'accept-post'],
  status: 'stable',
};
