import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'dockerignore-generator',
  name: '.dockerignore Generator',
  category: 'developer',
  summary:
    'Build a .dockerignore for a lean Docker build context — pick a stack preset and add custom lines.',
  description:
    'Create a .dockerignore to keep your Docker build context small and fast. Choose a preset tuned for a common stack (Node, Python, Java, Go or generic), start from the sensible defaults, and prepend or append your own glob patterns. The generator explains why each pattern matters and warns about common pitfalls like ignoring files you still need in the image.',
  keywords: [
    'dockerignore generator',
    'docker ignore file',
    'docker build context',
    'dockerignore patterns',
    'shrink docker context',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'preset',
      label: 'Stack preset',
      type: 'select',
      choices: [
        { value: 'node', label: 'Node.js' },
        { value: 'python', label: 'Python' },
        { value: 'java', label: 'Java' },
        { value: 'go', label: 'Go' },
        { value: 'generic', label: 'Generic' },
      ],
      default: 'node',
    },
    {
      key: 'includeHidden',
      label: 'Include common ignored dotfiles',
      type: 'boolean',
      default: true,
    },
    {
      key: 'extra',
      label: 'Extra patterns (one per line)',
      type: 'textarea',
      default: '',
      placeholder: 'build/\ncoverage/',
    },
    {
      key: 'sectionComments',
      label: 'Add section comments',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A Node project',
      input: '',
      options: { preset: 'node', extra: 'dist/\ncoverage/' },
    },
    {
      title: 'Python with a local data directory',
      input: '',
      options: { preset: 'python', extra: 'local-data/' },
    },
    {
      title: 'Minimal list without section comments',
      input: '',
      options: { preset: 'generic', sectionComments: false, includeHidden: false },
    },
  ],
  related: ['docker-compose', 'dockerfile-generator', 'gitignore', 'editorconfig'],
  status: 'stable',
};
