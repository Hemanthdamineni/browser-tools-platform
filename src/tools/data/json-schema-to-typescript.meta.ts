import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-schema-to-typescript',
  name: 'JSON Schema to TypeScript',
  category: 'data',
  summary:
    'Turn a JSON Schema into TypeScript interfaces and types, including $defs, unions and enums.',
  description:
    'Paste a JSON Schema (draft-07 or 2020-12) and get TypeScript declarations: objects become interfaces or type aliases, $defs and definitions become named types, enums become literal unions, and anyOf/oneOf/allOf map to unions and intersections. Property optionality follows the required list, quoted keys stay quoted, and descriptions turn into JSDoc comments. Everything is generated on your device.',
  keywords: [
    'json schema to typescript',
    'generate typescript types',
    'json schema interface generator',
    'ts type from schema',
    'json schema types',
    'openapi schema typescript',
    'defs to types',
    'typescript codegen schema',
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
      key: 'style',
      label: 'Object style',
      type: 'select',
      choices: [
        { value: 'interface', label: 'interface' },
        { value: 'type', label: 'type alias' },
      ],
      default: 'interface',
    },
    {
      key: 'exportTypes',
      label: 'Prefix declarations with export',
      type: 'boolean',
      default: true,
    },
    {
      key: 'readonlyProps',
      label: 'Mark properties readonly',
      type: 'boolean',
      default: false,
    },
    {
      key: 'comments',
      label: 'Copy descriptions as JSDoc',
      type: 'boolean',
      default: true,
    },
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
      max: 8,
    },
  ],
  examples: [
    {
      title: 'Object with required and $defs',
      input:
        '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "title": "User",\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "integer" },\n    "name": { "type": "string" },\n    "role": { "$ref": "#/$defs/Role" }\n  },\n  "$defs": { "Role": { "enum": ["admin", "user"] } }\n}',
    },
    {
      title: 'Unions and arrays',
      input:
        '{\n  "type": "object",\n  "required": ["items"],\n  "properties": {\n    "items": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },\n    "count": { "type": ["integer", "null"] }\n  }\n}',
    },
    {
      title: 'Inline reference to $defs',
      input:
        '{\n  "type": "object",\n  "properties": {\n    "status": { "$ref": "#/$defs/Status" },\n    "meta": { "$ref": "#/$defs/Meta" }\n  },\n  "$defs": {\n    "Status": { "enum": ["draft", "live", "archived"] },\n    "Meta": { "type": "object", "properties": { "rev": { "type": "integer" } }, "required": ["rev"] }\n  }\n}',
    },
  ],
  related: ['json-to-jsonschema', 'json-to-typescript', 'json-schema-check', 'json-to-zod'],
  status: 'stable',
};
