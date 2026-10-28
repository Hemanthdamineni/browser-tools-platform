import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'conventional-commit',
  name: 'Conventional Commit Builder',
  category: 'developer',
  summary:
    'Compose a Conventional Commits message — type, scope, breaking change and body — and copy the ready commit text.',
  description:
    'Build a conventional commit message the spec way: pick a type (feat, fix, docs, refactor, perf, test, build, ci, chore, revert), an optional scope, mark breaking changes with a !, and paste a short description. The tool assembles the final subject, appends the body and a BREAKING CHANGE footer when needed, warns when the subject is too long, and formats whitespace. 100% on-device.',
  keywords: [
    'conventional commits',
    'commit message generator',
    'commit template',
    'git commit message',
    'semantic commit',
    'commit style',
    'conventional commit builder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      choices: [
        { value: 'feat', label: 'feat' },
        { value: 'fix', label: 'fix' },
        { value: 'docs', label: 'docs' },
        { value: 'style', label: 'style' },
        { value: 'refactor', label: 'refactor' },
        { value: 'perf', label: 'perf' },
        { value: 'test', label: 'test' },
        { value: 'build', label: 'build' },
        { value: 'ci', label: 'ci' },
        { value: 'chore', label: 'chore' },
        { value: 'revert', label: 'revert' },
      ],
      default: 'feat',
    },
    {
      key: 'scope',
      label: 'Scope',
      type: 'text',
      default: '',
      placeholder: 'e.g. api',
    },
    {
      key: 'breaking',
      label: 'Breaking change',
      type: 'boolean',
      default: false,
    },
    {
      key: 'breakingDetail',
      label: 'Breaking change description (optional)',
      type: 'text',
      default: '',
    },
    {
      key: 'body',
      label: 'Body (optional, one line per paragraph)',
      type: 'text',
      default: '',
    },
  ],
  examples: [
    {
      title: 'A subject',
      input: 'Add pagination to the list endpoint',
      options: { type: 'feat', scope: 'api' },
    },
  ],
  faq: [
    {
      q: 'What is Conventional Commits?',
      a: 'A widely used naming scheme that encodes the intent of a change in the commit subject — `feat(x): do thing` means a new feature in the x area. This tool produces that format so you match your team’s convention every time.',
    },
    {
      q: 'How are breaking changes shown?',
      a: 'A `!` is added right after type(scope), so `feat(api)!: ...`, and an optional BREAKING CHANGE: footer is appended from the detail field.',
    },
    {
      q: 'Why warn about the length?',
      a: 'The spec suggests keeping subjects below ~72 characters so git and emailing lists stay readable. A note appears when yours is longer; it is only a hint, not a hard failure.',
    },
  ],
  related: [  "diff-text",
  "markdown-table",
  "semver",
  "slugify"],
  status: 'stable',
};
