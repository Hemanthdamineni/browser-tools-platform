import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-go-struct',
  name: 'JSON to Go Struct',
  category: 'data',
  summary:
    'Generate idiomatic Go structs with json tags from a JSON sample, ready for encoding/json round-trips.',
  description:
    'Paste any JSON object or array and get Go struct definitions with json tags that round-trip through encoding/json. Types are inferred: string, bool, int, float64, nested structs, slices, and interface{} with a comment when a value is null or mixed. Field names are Pascal-cased with common acronyms (ID, URL, API) kept uppercase.',
  keywords: [
    'json to go',
    'go struct generator',
    'golang struct',
    'json to golang',
    'go type',
    'encoding/json',
    'json tags',
    'struct definition',
    'go code generator',
    'json to go struct',
    'golang json unmarshal',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root struct name',
      type: 'text',
      default: 'MyStruct',
      placeholder: 'MyStruct',
    },
    {
      key: 'omitempty',
      label: 'Add omitempty to json tags',
      type: 'boolean',
      default: true,
    },
    {
      key: 'tags',
      label: 'JSON tags',
      type: 'select',
      default: 'json',
      choices: [
        { value: 'json', label: 'Include json tags' },
        { value: 'none', label: 'No tags' },
      ],
    },
  ],
  examples: [
    {
      title: 'Nested object with arrays',
      input: '{"name":"Ada","age":36,"active":true,"score":9.5,"address":{"city":"London","zip":"SW1"},"skills":["go","ts"],"tags":[]}',
      options: { rootName: 'User' },
    },
    {
      title: 'Array of objects',
      input: '[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]',
      options: { rootName: 'User' },
    },
    {
      title: 'Nulls and mixed types',
      input: '{"a":null,"b":[1,"two"],"c":{}}',
      options: { rootName: 'Mixed' },
    },
  ],
  faq: [
    {
      q: 'How are types inferred?',
      a: 'Strings become string, booleans bool, whole numbers int, fractional numbers float64. Objects become nested named structs, and arrays become slices of their element type. A null value or an array containing mixed types becomes interface{}, flagged with a // comment so you can tighten it by hand.',
    },
    {
      q: 'Will the generated struct round-trip my JSON?',
      a: 'Yes: every field carries a json tag matching the original key (with omitempty unless you disable it), so encoding/json marshals and unmarshals the same payloads. Field names are only Go-side cosmetics and never affect the wire format.',
    },
    {
      q: 'How are field and struct names derived?',
      a: 'Keys are Pascal-cased (user_name becomes UserName) and common acronyms stay uppercase (id becomes ID, url becomes URL, api becomes API). Invalid or colliding names get a numeric suffix so the output always compiles.',
    },
    {
      q: 'What about empty containers and null?',
      a: 'An empty array has no element type to infer, so it becomes []interface{}. A null value has no type at all, so it becomes interface{}. Both receive a comment telling you the value was empty or null.',
    },
    {
      q: 'Does it handle nested or repeated shapes?',
      a: 'Nested objects are hoisted into named types (one per shape) so the definition stays readable and reusable. A slice of objects gets its own element type. Duplicate keys in the JSON resolve to the last value, matching Go\'s encoding/json behaviour.',
    },
  ],
  related: ['json-to-typescript', 'json-to-yaml', 'json-minify', 'yaml-to-json', 'csv-to-json'],
  status: 'stable',
};
