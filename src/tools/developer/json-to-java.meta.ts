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
  related: ['json-to-typescript', 'json-to-csharp', 'json-to-go-struct', 'json-to-swift'],
  status: 'stable',
};
