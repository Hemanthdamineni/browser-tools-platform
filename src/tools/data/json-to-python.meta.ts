import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-python',
  name: 'JSON to Python Dataclasses',
  category: 'data',
  summary:
    'Generate Python dataclass or TypedDict definitions from a JSON sample, with nested models.',
  description:
    'Paste a JSON sample and get ready-to-paste Python type definitions. Objects become @dataclass classes (or TypedDict subclasses when you prefer maps), arrays become lists of the inferred element type, numbers become int or float, and nulls or optionally-typed fields get sensible defaults. Nested objects are hoisted into their own named models, keys can be snake_cased, and the output is import-clean for modern Python. All inference runs on your device.',
  article: [
    {
      heading: 'What it returns',
      body: 'Input is one JSON value as text, up to 1,000,000 characters; the output is a Python module — imports, then one class per shape. Objects are walked depth-first into named models, arrays become list[Element], whole numbers int, fractional numbers float, booleans bool and strings str. Only the first array element is sampled, so a mixed array collapses to the type of that entry.',
    },
    {
      heading: 'When the sample comes from an API contract',
      body: 'When you hold a representative response body and want typed models before writing any parsing code, paste it and take the generated classes straight into the project. Dataclass is the default style; choose TypedDict when your codebase prefers mapping-style types.',
    },
    {
      heading: 'The options that change the output',
      body: 'style picks @dataclass or TypedDict. snakeCase rewrites camelCase keys to snake_case field names — switch it off to keep the JSON key verbatim. useOptional annotates non-list fields as optional and defaults them from the sample, and unionSyntax chooses Optional[str] or str | None. indent accepts 2, 3, 4, 6 or 8 spaces; any other value is rejected.',
    },
    {
      heading: 'Guessed types, gaps and privacy',
      body: 'A JSON null always becomes Optional[Any] = None rather than a concrete type, empty arrays become list[Any], and keys that would not be valid Python identifiers are prefixed so the module still parses. The conversion is a pure function in this tab: JavaScript parses and emits everything on this device, nothing is uploaded and nothing survives the page.',
    },
  ],
  keywords: [
    'json to python',
    'json to dataclass',
    'python dataclass generator',
    'json typeddict',
    'json to python types',
    'python model generator',
    'json to pydantic-style',
    'schema to python dataclass',
    'json codegen python',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'style',
      label: 'Emit style',
      type: 'select',
      choices: [
        { value: 'dataclass', label: '@dataclass' },
        { value: 'typeddict', label: 'TypedDict' },
      ],
      default: 'dataclass',
    },
    {
      key: 'rootName',
      label: 'Root class name',
      type: 'text',
      default: 'Root',
      placeholder: 'Root',
    },
    {
      key: 'useOptional',
      label: 'Make fields optional with None default',
      type: 'boolean',
      default: true,
    },
    {
      key: 'snakeCase',
      label: 'snake_case field names',
      type: 'boolean',
      default: true,
    },
    {
      key: 'unionSyntax',
      label: 'Optional annotation style',
      type: 'select',
      choices: [
        { value: 'optional', label: 'Optional[str]' },
        { value: 'pipe', label: 'str | None' },
      ],
      default: 'optional',
    },
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 4,
      min: 2,
      max: 8,
    },
  ],
  examples: [
    {
      title: 'Nested object sample',
      input:
        '{\n  "userId": 42,\n  "name": "Ada",\n  "active": true,\n  "tags": ["admin"],\n  "profile": { "bio": "hi", "age": 37 }\n}',
    },
    {
      title: 'List of objects',
      input: '[{"id": 1, "label": "one"}, {"id": 2, "label": "two"}]',
      options: { rootName: 'Item' },
    },
    {
      title: 'Nulls as TypedDict with pipe unions',
      input: '{"eventId": 7, "note": null, "tags": ["a", "b"], "metrics": {"p95": 1.25}}',
      options: { style: 'typeddict', unionSyntax: 'pipe', indent: 2 },
    },
  ],
  faq: [
    {
      q: 'Which Python version is the output for?',
      a: 'The generated module uses from __future__ import annotations and built-in generics (list[x], dict[str, x]), so it is compatible with Python 3.9+. The "str | None" union style needs 3.10+; Optional[str] is the safe default.',
    },
    {
      q: 'How are arrays handled?',
      a: 'Arrays become list[Element]. If the element is an object, a new model is generated (or reused) and the field is list[ThatModel].',
    },
    {
      q: 'What about recursive or repeated shapes?',
      a: 'Each distinct nested shape is emitted exactly once, named after its key, and later uses reference the same model. If a model would recurse, the forward reference stays valid thanks to the postponed annotations import.',
    },
    {
      q: 'Is this a full schema?',
      a: 'No — it is a type-guessing tool like the rest of the JSON family. Edge cases such as genuinely mixed-type arrays or optional fields missing from the sample are inferred optimistically, so review the output.',
    },
  ],
  related: ['json-to-typescript', 'json-to-go-struct', 'json-to-zod', 'json-to-jsonschema'],
  status: 'stable',
};
