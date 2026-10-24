import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-mongodb',
  name: 'JSON to MongoDB',
  category: 'developer',
  summary:
    'Wrap JSON documents in a mongosh insertMany script for a collection, exactly as BSON-ready documents.',
  description:
    'Turn a JSON array (or single object) into a ready-to-run mongosh command: db.<collection>.insertMany([...]);. JSON is embedded verbatim as JavaScript object literals so exact types survive — no quoting surprises. Choose compact or pretty formatting, toggle the wrapper, and pick your collection name.',
  keywords: [
    'json to mongodb',
    'mongosh insertMany',
    'json to mongosh',
    'insert documents mongo',
    'mongodb insert script',
    'json to mongo documents',
    'collection insert',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'collection',
      label: 'Collection name',
      type: 'text',
      default: 'items',
      placeholder: 'users',
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      choices: [
        { value: 'pretty', label: 'Pretty (multi-line)' },
        { value: 'compact', label: 'Compact (one line)' },
      ],
      default: 'pretty',
    },
    {
      key: 'wrapped',
      label: 'Wrap in db.collection.insertMany script',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indentSpaces',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
      max: 8,
    },
  ],
  article: [
    {
      heading: 'From JSON to a runnable mongosh command',
      body: 'Paste a JSON array of documents — or a single object — and the tool emits db.<collection>.insertMany([ … ]); ready to paste into mongosh or a MongoDB shell. Because the JSON object literals are embedded verbatim, types survive the trip: a number stays a number, a boolean stays a boolean, and nested objects and arrays map one-to-one onto BSON documents and arrays.',
    },
    {
      heading: 'The options that shape the output',
      body: 'Collection name sets the identifier used in the script. Output format switches between a compact single line and pretty multi-line output. Wrap in db.collection.insertMany lets you drop the script wrapper and get just the raw documents, for pasting into another tool. Indent width controls the pretty-print step from 0 to 8 spaces. The collection name is validated as a MongoDB identifier, so letters, digits and underscores only — a dash or space is rejected up front.',
    },
    {
      heading: 'A typical workflow',
      body: 'You exported some rows as JSON from an API or a spreadsheet and want them in a scratch collection for testing. Paste the array, set the collection name, copy the generated script, and run it against your dev database. There is no file to upload and no driver to install — the script is plain text you can read, review and commit alongside code.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Every item must be a JSON object, so a bare array of scalars or a null element is rejected with a message naming the offending index; a non-finite number such as NaN is rejected too, since JSON has no way to express it — use null instead. Input is capped at roughly two million characters. The conversion is done entirely with the browser’s JSON parser, with no network call, so your data stays on your device.',
    },
  ],
  examples: [
    {
      title: 'A users collection',
      input:
        '[{"name":"Ada","role":"admin","active":true},{"name":"Lin","role":"dev","active":false}]',
      options: { collection: 'users' },
    },
    {
      title: 'A single document',
      input: '{"sku":"A-1","stock":12}',
      options: { collection: 'products' },
    },
    {
      title: 'Compact output without the wrapper',
      input: '[{"a":1},{"a":2}]',
      options: { collection: 'items', format: 'compact', wrapped: false },
    },
  ],
  faq: [
    {
      q: 'Is this valid mongosh input?',
      a: 'Yes — the JSON is embedded as JavaScript object literals, exactly what mongosh executes. Numbers, booleans, nested documents and arrays map 1:1 to BSON types.',
    },
    {
      q: 'What if my top level is a single object?',
      a: 'A single object becomes a one-document insertMany call — no manual wrapping needed.',
    },
    {
      q: 'Why mongosh instead of mongoimport?',
      a: 'insertMany runs in any shell and keeps your data as plain script you can review and version, while mongoimport is a bulk file path. This tool targets the script path.',
    },
  ],
  related: ['json-to-sql', 'json-to-csv', 'json-to-yaml', 'json-format'],
  status: 'stable',
};
