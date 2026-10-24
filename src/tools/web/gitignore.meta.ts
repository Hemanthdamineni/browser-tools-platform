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
  examples: [
    { title: 'Node.js', input: 'node' },
    { title: 'Python virtualenv project', options: { stack: 'python' } },
    { title: 'OS and editor cruft only', options: { stack: 'general' } },
  ],
  faq: [
    {
      q: 'Does it untrack files already committed?',
      a: 'No. .gitignore only affects untracked files. Run git rm -r --cached . once (then commit) to stop tracking files that were committed before the rule existed.',
    },
    {
      q: 'Why does every stack include .DS_Store and Thumbs.db?',
      a: 'The general block with OS, log and editor patterns is appended to every stack except the General only choice, so the same cruft is covered whichever stack you pick.',
    },
    {
      q: 'Can I combine two stacks in one file?',
      a: 'No. The generator emits one stack per run. Generate each stack you need and paste the lines into a single .gitignore; repeated lines inside one run are already deduplicated for you.',
    },
  ],
  article: [
    {
      heading: 'What the generated file contains',
      body: 'Choose a stack and the tool prints a .gitignore body: the ignore patterns for that stack plus a general block with .DS_Store, Thumbs.db, *.log and editor folders. Lines are deduplicated in order, so a pattern shared by the stack and the general block appears once.',
    },
    {
      heading: 'Starting a repository',
      body: 'Use it when you are initialising a project and would rather not hunt through another repo for the right lines, or when a teammate keeps committing an .idea folder. Pick Node.js for a JavaScript app, Python for a virtualenv-based service, and so on.',
    },
    {
      heading: 'What each stack covers',
      body: 'Node brings node_modules, dist, coverage and .env with an exception for .env.example. Python brings __pycache__, .venv and the type-checker caches. Rust ignores /target, Go ignores /bin and vendor, Java Maven ignores target and class files. macOS, Windows, Linux, JetBrains and VS Code entries cover OS and editor cruft, and General only emits the shared block on its own.',
    },
    {
      heading: 'It cannot untrack a committed file',
      body: 'The output is a suggestion, not a migration. .gitignore only affects untracked files, so anything committed earlier keeps appearing in git status until it is removed from the index.',
    },
    {
      heading: 'Built from constants in the page',
      body: 'The pattern lists are constants shipped with the tool; no path, project name or repository detail is transmitted, and the generator runs without a network connection.',
    },
  ],
  related: ['editorconfig', 'robots-txt'],
  status: 'stable',
};
