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
  related: ['json-format', 'json-flatten'],
  status: 'stable',
};
