import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gitignore',
  name: '.gitignore Generator',
  category: 'web',
  summary: 'Generate a .gitignore for Node, Python, Rust, Go, Java, macOS, Windows and more.',
  description:
    'Pick your stack and get a sensible .gitignore covering dependency folders, build output, env files, logs and OS/editor cruft. The general block (DS_Store, Thumbs.db, logs, editor folders) is always included and lines are deduplicated.',
  keywords: [
    'gitignore',
    'git ignore generator',
    'node gitignore',
    'python gitignore',
    'rust gitignore',
    'ignore file',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'stack',
      label: 'Stack',
      type: 'select',
      default: 'node',
      choices: [
        { value: 'node', label: 'Node.js' },
        { value: 'python', label: 'Python' },
        { value: 'rust', label: 'Rust' },
        { value: 'go', label: 'Go' },
        { value: 'java-maven', label: 'Java (Maven)' },
        { value: 'macos', label: 'macOS' },
        { value: 'windows', label: 'Windows' },
        { value: 'linux', label: 'Linux' },
        { value: 'jetbrains', label: 'JetBrains IDEs' },
        { value: 'vscode', label: 'VS Code' },
        { value: 'general', label: 'General only' },
      ],
    },
  ],
  examples: [{ title: 'Node.js', input: 'node' }],
  faq: [
    {
      q: 'Does it untrack files already committed?',
      a: 'No. .gitignore only affects untracked files. Run git rm -r --cached . once (then commit) to stop tracking files that were committed before the rule existed.',
    },
  ],
  related: [  "editorconfig",
  "robots-txt"],
  status: 'stable',
};
