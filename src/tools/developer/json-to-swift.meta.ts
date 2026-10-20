import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-swift',
  name: 'JSON to Swift Struct',
  category: 'developer',
  summary:
    'Generate Swift Codable structs from a JSON sample so API payloads decode cleanly in iOS apps.',
  description:
    'Paste a JSON object or array and get Swift structs that decode it with Codable: inferred types, nested structs for nested objects, array element types, an optional CodingKeys enum that maps snake_case keys back to camelCase properties, and a usage comment showing JSONDecoder. Works entirely on-device.',
  keywords: [
    'json to swift',
    'swift struct generator',
    'codable',
    'jsondecoder',
    'swift codable',
    'ios json decode',
    'camelcase key',
    'swift model',
    'json to swift struct',
    'decodable',
    'swift api model',
    'codingkeys',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root struct name',
      type: 'text',
      default: 'Root',
      placeholder: 'Root',
    },
    {
      key: 'codingKeys',
      label: 'Emit CodingKeys enum for non-matching keys',
      type: 'boolean',
      default: true,
    },
    {
      key: 'propertyStyle',
      label: 'Property declaration',
      type: 'select',
      default: 'let',
      choices: [
        { value: 'let', label: 'let (immutable)' },
        { value: 'var', label: 'var (mutable)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Snake_case payload',
      input:
        '{"user_id":1,"user_name":"Ada","is_active":true,"roles":["admin"],"address":{"city":"London"}}',
      options: { rootName: 'User' },
    },
    {
      title: 'Array of objects',
      input: '[{"id":1,"name":"Ada"}]',
      options: { rootName: 'User' },
    },
  ],
  faq: [
    {
      q: 'How are types inferred?',
      a: 'Strings become String, booleans Bool, whole numbers Int, fractional numbers Double, nested objects become nested structs, arrays become [String]/[Int]/[Bool]/[Double]/[NestedStruct]. Nulls, empty arrays and mixed arrays fall back to String? / [String], which decode safely — tighten them once you know the real type.',
    },
    {
      q: 'Why a CodingKeys enum and when is it emitted?',
      a: 'Swift decodes by property name, so snake_case JSON keys need mapping to camelCase properties. CodingKeys carries a `case property = "json_key"` for every key whose spelling differs from its Swift name. Keys that already match are left out; disable the option to rely on decoder key-decoding strategies instead.',
    },
    {
      q: 'Does this cover decoding optional values?',
      a: 'Properties generated from a present value are non-optional. A field that is null in the sample becomes String? so it decodes as nil instead of throwing. Make present-but-sometimes-missing fields optional yourself with `String?`.',
    },
    {
      q: 'What about array and empty roots?',
      a: 'A root array generates a struct for the sampled element plus a comment showing `JSONDecoder().decode([Root].self, from: data)`. An empty array cannot be typed, so it raises an error, as do primitive roots.',
    },
  ],
  related: [
    'json-to-typescript',
    'json-to-go-struct',
    'json-to-zod',
    'json-to-csharp',
    'json-to-csv',
  ],
  status: 'stable',
};
