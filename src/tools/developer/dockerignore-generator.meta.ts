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
  ],
  faq: [
    {
      q: 'What does a .dockerignore actually do?',
      a: 'It excludes files from the build context sent to the Docker daemon, shrinking the upload and the image build. It does not remove files already in the image from earlier layers.',
    },
    {
      q: 'Do I need .gitignore in it?',
      a: 'Usually yes — .git, .gitignore and other VCS/CI metadata rarely belong in a build context. The preset includes them; you can toggle sections with the options.',
    },
    {
      q: 'Is this the same as a .gitignore?',
      a: 'Related but different: .gitignore keeps files out of version control; .dockerignore keeps them out of the Docker build context. Both are here — check the gitignore tool for the former.',
    },
  ],
  related: ['docker-compose', 'dockerfile-generator', 'gitignore', 'editorconfig'],
  status: 'stable',
};
