import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-java',
  name: 'JSON to Java',
  category: 'developer',
  summary: 'Generate Java POJO, Lombok or record classes from JSON with nested types and getters.',
  description:
    'Turn a JSON object or array of objects into Java classes. Keys become camelCase fields with inferred wrapper types (String, Integer, Long, Double, Boolean), nested objects become nested static classes, and arrays become List<T>. Choose plain POJOs with getters and setters, Lombok @Data classes, or Java 16 records, and optionally add a package declaration.',
  keywords: [
    'json to java',
    'java pojo generator',
    'json to pojo',
    'java dto generator',
    'json to record',
    'lombok class generator',
    'json to java class',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'className',
      label: 'Root class name',
      type: 'text',
      default: 'Model',
      placeholder: 'User',
    },
    {
      key: 'packageName',
      label: 'Package (optional)',
      type: 'text',
      default: '',
      placeholder: 'com.example.api',
    },
    {
      key: 'style',
      label: 'Class style',
      type: 'select',
      choices: [
        { value: 'pojo', label: 'POJO with getters/setters' },
        { value: 'lombok', label: 'Lombok @Data' },
        { value: 'record', label: 'Java record' },
      ],
      default: 'pojo',
    },
    {
      key: 'useWrapperTypes',
      label: 'Use wrapper types (nullable-safe)',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A user object',
      input: '{"id":1,"name":"Ada","active":true,"tags":["math"]}',
      options: { className: 'User' },
    },
    {
      title: 'Array of objects to Java records',
      input: '[{"id":1,"name":"Ada"},{"id":2,"name":"Alan"}]',
      options: { className: 'User', style: 'record' },
    },
    {
      title: 'Lombok class with a package',
      input: '{"order_id":7,"total":12.5,"shipped":false}',
      options: { className: 'Order', packageName: 'com.example.api', style: 'lombok' },
    },
  ],
  faq: [
    {
      q: 'Which types are inferred?',
      a: 'Strings become String, whole numbers Integer (or Long when they exceed int range), decimals Double, booleans Boolean, nulls Object, nested objects a nested class, and arrays List<T>. Wrapper types are used by default so null values are safe.',
    },
    {
      q: 'How are keys turned into field names?',
      a: 'Keys are camelCased (user_name and user-name both become userName), invalid characters are stripped, and Java reserved words get a trailing underscore (class → class_).',
    },
    {
      q: 'What do the three styles emit?',
      a: 'POJO emits fields plus getters and setters; Lombok emits @Data with fields only; record emits a Java 16+ record with a canonical constructor. Nested types are emitted as nested static classes (or nested records).',
    },
  ],
  article: [
    {
      heading: 'What gets generated',
      body: 'The top level must be a JSON object or an array of objects; for an array the first element shapes the root class. Every key becomes a field, and each nested object is emitted as a nested static class so the generated file compiles as a single unit. The header always imports java.util.List, and a Lombok style additionally imports lombok.Data.',
    },
    {
      heading: 'Type inference and wrappers',
      body: 'Strings map to String, whole numbers to Integer unless they exceed int range and then to Long, decimals to Double, booleans to Boolean and nulls to Object. Arrays become List of the element type. With wrapper types enabled every field uses the boxed form, so a missing or null JSON value is representable; disabling it emits primitives such as int, which cannot hold null.',
    },
    {
      heading: 'Field names come from your keys',
      body: 'Keys are camelCased, so user_name and user-name both become userName, and characters that are not legal in an identifier are stripped. A key that collides with a Java reserved word gets a trailing underscore, so class becomes class_. When two keys collapse to the same field name, only the first is kept.',
    },
    {
      heading: 'Choosing between POJO, Lombok and records',
      body: 'The POJO style writes private fields with getters and setters. Lombok emits an @Data class with fields only, leaving the boilerplate to the annotation processor. The record style emits a Java 16 or newer record with a canonical constructor and nested records, which is the shortest output but requires a modern toolchain and immutable data.',
    },
    {
      heading: 'Generation is local and instant',
      body: 'The generator runs entirely in the page — the JSON you paste is never uploaded and no request is made, so it works with the browser offline. Because the shape is inferred from a sample, a field that is absent from the sample will not appear in the generated class.',
    },
  ],
  related: ['json-to-typescript', 'json-to-csharp', 'json-to-go-struct', 'json-to-swift'],
  status: 'stable',
};
