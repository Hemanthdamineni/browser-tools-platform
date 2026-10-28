import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-patch',
  name: 'JSON Patch',
  category: 'data',
  summary: 'Apply RFC 6902 JSON Patch operations to a JSON document in your browser.',
  description:
    'Apply add, remove, replace, move, copy and test operations to a JSON value using RFC 6902 JSON Patch and JSON Pointer paths. The input is left unchanged and the patched document is returned locally.',
  keywords: [
    'json patch',
    'rfc 6902',
    'json pointer',
    'patch json',
    'json update operations',
    'add remove replace json',
    'json document patcher',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'patch',
      label: 'JSON Patch operations',
      type: 'textarea',
      default: '[\n  { "op": "replace", "path": "/name", "value": "New name" }\n]',
      placeholder: '[{ "op": "add", "path": "/key", "value": "value" }]',
    },
    {
      key: 'indent',
      label: 'Output indentation',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
        { value: 'tab', label: 'Tab' },
        { value: '0', label: 'Minified' },
      ],
    },
  ],
  examples: [
    {
      title: 'Add a property',
      input: '{ "name": "Ada" }',
      options: { patch: '[{ "op": "add", "path": "/active", "value": true }]' },
    },
    {
      title: 'Update a nested value',
      input: '{ "user": { "name": "Ada" } }',
      options: { patch: '[{ "op": "replace", "path": "/user/name", "value": "Grace" }]' },
    },
    {
      title: 'Test a value before changes',
      input: '{ "version": 1, "items": ["a"] }',
      options: {
        patch:
          '[{ "op": "test", "path": "/version", "value": 1 }, { "op": "add", "path": "/items/-", "value": "b" }]',
      },
    },
  ],
  faq: [
    {
      q: 'Which operations are supported?',
      a: 'The tool supports RFC 6902 add, remove, replace, move, copy and test. A failed operation stops processing and no partial document is returned.',
    },
    {
      q: 'What syntax do paths use?',
      a: 'Paths use JSON Pointer: they start with /, and ~1 escapes a slash while ~0 escapes a tilde in a property name. Use /- to append to an array.',
    },
    {
      q: 'Is my document uploaded?',
      a: 'No. Parsing and patching happen in your browser; no network requests are made by this tool.',
    },
  ],
  related: [  "json-format",
  "json-diff",
  "json-to-jsonschema"],
  status: 'stable',
};
