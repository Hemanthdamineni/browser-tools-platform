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
  ],
  faq: [
    {
      q: 'What type mapping is applied?',
      a: 'strings become string, booleans bool, whole numbers int, fractional numbers double, null object?, objects become nested classes, arrays become List<T> of the sampled element type, empty arrays List<object>, and mixed arrays List<object>.',
    },
    {
      q: 'Do I need the attributes for deserialization?',
      a: 'No. System.Text.Json matches properties case-insensitively by default, so deserialization works without them. The attributes only help when you need exact key mapping, camelCase mismatch, or JSON serialization to emit different names than the C# properties.',
    },
    {
      q: 'Why are properties PascalCase?',
      a: 'The .NET naming convention is PascalCase. The generator converts snake_case and camelCase keys to PascalCase and uppercases common acronyms (URL, ID, API, JSON). The [JsonPropertyName] attribute keeps the original JSON key when attributes are enabled.',
    },
    {
      q: 'What about root arrays and empty values?',
      a: 'A root array generates a class for the sampled element and a usage comment showing List<Root>. An empty root array cannot be typed, so it errors. Empty nested arrays become List<object> and nulls become object? — tighten these to concrete types where you know them.',
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
