import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-csharp',
  name: 'JSON to C# Class',
  category: 'developer',
  summary:
    'Generate C# classes and record types from a JSON sample for System.Text.Json deserialization.',
  description:
    'Paste a JSON object or array and get ready-to-use C# code: classes (or records) with inferred property types, nested object and List<T> types, and optional [JsonPropertyName] attributes that map exactly back to the original JSON keys. Works with System.Text.Json out of the box — the generated usage comment shows how to deserialize with JsonSerializer.',
  keywords: [
    'json to c#',
    'json to csharp',
    'json to class',
    'c# class generator',
    'system.text.json',
    'json deserialize c#',
    'json to record',
    'c# dto generator',
    'json model c#',
    'jsonpropertyname',
    'c# object from json',
    'dotnet json',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root type name',
      type: 'text',
      default: 'Root',
      placeholder: 'Root',
    },
    {
      key: 'attributes',
      label: 'Emit [JsonPropertyName] attributes',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'User payload',
      input: '{"id":1,"name":"Ada","active":true,"roles":["admin"],"address":{"city":"London"}}',
      options: { rootName: 'User' },
    },
    {
      title: 'Without attributes',
      input: '[{"id":1,"name":"Ada"}]',
      options: { rootName: 'User', attributes: false },
    },
    {
      title: 'Nested array of objects',
      input:
        '{"orderId":9,"items":[{"sku":"A","qty":2},{"sku":"B","qty":1}],"note":null,"tags":[]}',
      options: { rootName: 'Order' },
    },
  ],
  related: [
    'json-to-typescript',
    'json-to-go-struct',
    'json-to-zod',
    'json-to-yaml',
    'curl-to-code',
  ],
  status: 'stable',
};
