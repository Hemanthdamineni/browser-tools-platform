import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ndjson',
  name: 'NDJSON <-> JSON Array',
  category: 'data',
  summary: 'Convert newline-delimited JSON to a JSON array and back, one compact value per line.',
  description:
    'Turn NDJSON / JSON Lines (one JSON value per line) into a single JSON array, or split a JSON array into one compact JSON value per line. Blank lines are ignored; a malformed line is reported by number.',
  keywords: [
    'ndjson',
    'json lines',
    'jsonl',
    'newline delimited json',
    'json array',
    'ndjson to json',
    'json to ndjson',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'to-array',
      choices: [
        { value: 'to-array', label: 'NDJSON → JSON array' },
        { value: 'to-ndjson', label: 'JSON array → NDJSON' },
      ],
    },
    {
      key: 'indent',
      label: 'Array output',
      type: 'select',
      default: 'none',
      choices: [
        { value: 'none', label: 'Compact' },
        { value: '2', label: 'Pretty (2 spaces)' },
      ],
      showWhen: { key: 'mode', value: 'to-array' },
    },
  ],
  article: [
    {
      heading: 'Two directions behind one switch',
      body: 'In the default direction every non-blank input line is parsed as a JSON value and collected into a single JSON array, with a malformed line reported by its line number. Switch Direction to "JSON array → NDJSON" and a top-level array is emitted as one compact JSON value per line. Either way the stats report how many elements came out.',
    },
    {
      heading: 'Where NDJSON turns up',
      body: 'Use it when a log pipeline, a bulk upload endpoint, a warehouse export or a streaming API wants JSON Lines but you hold an array, or when someone hands you NDJSON and you need to read it as one document. It is also the fastest way to pretty-print a file of one-record-per-line data.',
    },
    {
      heading: 'The indent switch only works one way',
      body: 'In the NDJSON → array direction, Array output chooses between compact output and two-space pretty printing, which is what you want when reading or diffing the result. The other direction emits one compact value per line by definition, because pretty-printing would break the format, so the option is hidden and ignored there.',
    },
    {
      heading: 'What gets rejected',
      body: 'Blank and whitespace-only lines are skipped, but every other line must be a complete JSON value: trailing commas, comments and bare unquoted strings are not JSON and raise an error naming the offending line. Producing NDJSON requires a top-level array, so a single object is refused, and a null element is written as the JSON token null.',
    },
    {
      heading: 'Converted inside the tab',
      body: 'All parsing and serialising happens in your browser and the records are never uploaded. You can convert internal exports or customer data freely, with no network connection.',
    },
  ],
  examples: [
    {
      title: 'NDJSON to array',
      input: '{"id":1}\n{"id":2}\n{"id":3}',
      options: { mode: 'to-array' },
    },
    {
      title: 'Pretty array',
      input: '{"id":1}\n{"id":2}',
      options: { mode: 'to-array', indent: '2' },
    },
    {
      title: 'Array to NDJSON',
      input: '[{"id":1},{"id":2},{"id":3}]',
      options: { mode: 'to-ndjson' },
    },
  ],
  faq: [
    {
      q: 'What counts as a line?',
      a: 'Input is split on newlines. Empty or whitespace-only lines are skipped; every other line must be a complete JSON value.',
    },
    {
      q: 'Does the indent option affect NDJSON output?',
      a: 'No. When producing NDJSON each line is always a single compact JSON value. The indent option only pretty-prints the array in the other direction.',
    },
    {
      q: 'What about a byte-order mark or trailing whitespace?',
      a: 'A blank or whitespace-only line is skipped, and trailing spaces on a line are harmless because JSON.parse ignores surrounding whitespace. A byte-order mark at the very start is not: JSON.parse rejects it, so strip the BOM before converting.',
    },
  ],
  related: ['json-format', 'json-flatten'],
  status: 'stable',
};
