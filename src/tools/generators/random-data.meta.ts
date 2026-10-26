import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'random-data',
  name: 'Fake Data Generator',
  category: 'generators',
  summary:
    'Generate realistic fake datasets — people, contacts, addresses, products — as JSON, CSV or SQL.',
  description:
    'Produce bulk placeholder data for demos, tests and mockups. Choose a dataset, how many rows, and the output format. Everything is generated on-device with the browser CSPRNG — no sample ever leaves your machine.',
  keywords: [
    'fake data',
    'mock data',
    'test data',
    'dummy data',
    'random person',
    'sample data',
    'json csv sql',
    'placeholder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'dataset',
      label: 'Dataset',
      type: 'select',
      default: 'person',
      choices: [
        { value: 'person', label: 'Person' },
        { value: 'contact', label: 'Person + contact' },
        { value: 'address', label: 'Address' },
        { value: 'network', label: 'Network' },
        { value: 'commerce', label: 'Commerce' },
        { value: 'company', label: 'Company' },
        { value: 'lorem', label: 'Lorem sentence' },
        { value: 'ids', label: 'IDs (uuid, objectId, nanoid, ulid)' },
      ],
    },
    { key: 'rows', label: 'Rows', type: 'number', default: 10, min: 1, max: 500 },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'json',
      choices: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
        { value: 'sql', label: 'SQL INSERT' },
      ],
    },
    {
      key: 'tableName',
      label: 'SQL table name',
      type: 'text',
      default: 'data',
      showWhen: { key: 'format', value: 'sql' },
    },
  ],
  examples: [
    { title: '5 people as JSON', options: { dataset: 'person', rows: 5, format: 'json' } },
    { title: '20 contacts as CSV', options: { dataset: 'contact', rows: 20, format: 'csv' } },
    {
      title: '10 companies as SQL inserts',
      options: { dataset: 'company', rows: 10, format: 'sql', tableName: 'companies' },
    },
  ],
  related: ['random-string', 'lorem-ipsum', 'uuid'],
  status: 'stable',
};
