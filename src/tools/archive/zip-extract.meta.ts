import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'zip-extract',
  name: 'Extract ZIP Archive',
  category: 'archive',
  summary: 'Extract the entries of a ZIP archive as individual download files.',
  description:
    'List and extract ZIP entries locally. Each entry becomes a downloadable file; a small table reports what happened.',
  keywords: ['zip', 'unzip', 'extract', 'archive'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.zip,application/zip',
  options: [
    {
      key: 'filter',
      label: 'Path filter (optional)',
      type: 'text',
      default: '',
      placeholder: 'only extract paths containing…',
    },
  ],
  examples: [{ title: 'Extract a ZIP' }],
  related: ['zip-create', 'zip-inspect'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
};
