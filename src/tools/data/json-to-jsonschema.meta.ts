import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-jsonschema',
  name: 'JSON to JSON Schema',
  category: 'data',
  summary:
    'Infer a JSON Schema (draft 2020-12) from a JSON sample, with required and additionalProperties control.',
  description:
    'Give a representative JSON value and get back a JSON Schema that describes it. Objects produce properties plus a required list, arrays merge the schema of every element, and primitives map to their type. Everything runs in your browser.',
  keywords: [
    'json to json schema',
    'json schema generator',
    'infer json schema',
    'jsonschema',
    'draft 2020-12',
    'json schema from sample',
    'generate schema',
    'json validation schema',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'title',
      label: 'Schema title',
      type: 'text',
      default: '',
      placeholder: '(none)',
    },
    {
      key: 'requireAllProps',
      label: 'List every object key as required',
      type: 'boolean',
      default: true,
    },
    {
      key: 'additionalProperties',
      label: 'Allow additional properties',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Object with primitives',
      input: '{"name":"Ann","age":30,"active":true}',
    },
    {
      title: 'Merge an array of objects',
      input: '[{"a":1},{"a":2,"b":"x"}]',
    },
    {
      title: 'Titled, additional properties allowed',
      input: '{"id":1}',
      options: { title: 'Widget', additionalProperties: true },
    },
  ],
  faq: [
    {
      q: 'Which draft does it target?',
      a: 'Draft 2020-12. The output always sets "$schema" to the draft 2020-12 meta-schema URI.',
    },
    {
      q: 'How are arrays with different element shapes handled?',
      a: 'Element schemas are merged: object properties are unioned (a key present in every element stays required), and differing primitive types collapse to a "type" array such as ["integer", "string"].',
    },
    {
      q: 'Are integers distinguished from floats?',
      a: 'Yes. A whole number infers "integer"; a number with a fractional part infers "number".',
    },
  ],
  article: [
    {
      heading: 'From a sample value to a schema',
      body: 'Paste any JSON value — an object, an array or even a bare string — and the tool walks it to build a JSON Schema draft 2020-12 document, always stamped with the draft meta-schema URI and written as schema.json. Objects produce a properties map with a schema per key, arrays produce an items schema derived from their elements, strings, booleans, nulls map to their own types, and numbers are split into integer when they have no fractional part and number otherwise. A bare array or primitive at the root is handled just as well as an object.',
    },
    {
      heading: 'The two switches that change the shape',
      body: 'Listing every object key as required is on by default, which records the sample’s keys in the required array so a validator would reject a document missing any of them; turn it off when the sample just happened to include optional fields. The additional properties switch controls the additionalProperties keyword that is written on every object: off writes false, tightening the schema to exactly the keys seen, on writes true so extra members are permitted.',
    },
    {
      heading: 'How arrays of differing elements are merged',
      body: 'An array is rarely uniform, so element schemas are merged rather than taken from the first one. Object elements have their properties unioned, and a key is only listed as required if it appears in every element. When types disagree, integer and number collapse to number, distinct primitive types become a sorted type array such as ["integer", "string"], and shapes that cannot be reconciled are wrapped in anyOf. An empty array gets no items keyword at all.',
    },
    {
      heading: 'What it cannot infer and where it runs',
      body: 'A schema can only describe what the sample shows, so strings carry no format, length, pattern or enum, numbers carry no minimum or maximum, and there is no $defs reuse or title on nested objects — the title option applies to the root schema only. Because all of this is a single pass over text you paste, the JSON never leaves the browser; the conversion and the pretty-printed output are produced locally in the tab.',
    },
  ],
  related: ['json-to-typescript', 'json-format', 'json-to-yaml', 'ndjson'],
  status: 'stable',
};
