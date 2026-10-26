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
    {
      title: 'Deeper nesting, mutable properties',
      input: '{"id":7,"tags":["a","b"],"meta":{"created_at":"2024-01-01","views":12}}',
      options: { rootName: 'Article', propertyStyle: 'var' },
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
