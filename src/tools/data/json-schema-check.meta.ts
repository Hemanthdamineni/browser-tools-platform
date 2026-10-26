import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-schema-check',
  name: 'JSON Schema Checker',
  category: 'data',
  summary: 'Validate JSON against a practical subset of JSON Schema keywords.',
  description:
    'Check a JSON document against a schema using common keywords: type, required, properties, additionalProperties, items, enum, const, numeric and string bounds, pattern, and array bounds. Unsupported schema keywords are reported. This is not a full JSON Schema implementation.',
  keywords: [
    'json schema validator',
    'validate json schema',
    'json validation',
    'schema checker',
    'check json against schema',
    'validate JSON draft 2020-12',
    'required properties validation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Validate a document',
      input:
        '{"schema":{"type":"object","required":["name"],"properties":{"name":{"type":"string","minLength":2},"age":{"type":"integer","minimum":0}}},"document":{"name":"Ada","age":36}}',
    },
    {
      title: 'Show validation errors',
      input:
        '{"schema":{"type":"object","required":["id"],"properties":{"id":{"type":"integer"}}},"document":{"id":"abc"}}',
    },
    {
      title: 'Reject extra properties',
      input:
        '{"schema":{"type":"object","properties":{"name":{"type":"string"}},"additionalProperties":false},"document":{"name":"Ada","age":36}}',
    },
  ],
  related: ['json-to-jsonschema', 'json-format', 'json-patch'],
  status: 'stable',
};
