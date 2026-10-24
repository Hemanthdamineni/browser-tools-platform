import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'conventional-commit',
  name: 'Conventional Commit Builder',
  category: 'developer',
  summary:
    'Compose a Conventional Commits message — type, scope, breaking change and body — and copy the ready commit text.',
  description:
    'Build a conventional commit message the spec way: pick a type (feat, fix, docs, refactor, perf, test, build, ci, chore, revert), an optional scope, mark breaking changes with a !, and paste a short description. The tool assembles the final subject, appends the body and a BREAKING CHANGE footer when needed, warns when the subject is too long, and formats whitespace. 100% on-device.',
  article: [
    {
      heading: 'What goes in and what comes back',
      body: 'Type the change description into the input box: only the first non-empty line is read as the subject, and any further lines are discarded with a note pointing you at the body field. The result is the finished message — type, optional (scope), optional !, colon, subject — followed by a blank line and your body, then a blank line and a BREAKING CHANGE: footer when one applies.',
    },
    {
      heading: 'When release tooling reads your commits',
      body: 'Use it when a repository enforces Conventional Commits and the header has to be right first time, for instance tagging an auth endpoint change as feat(auth)!: so the release notes classify it as breaking. The type list spans the usual set from feat and fix through build, ci, chore and revert.',
    },
    {
      heading: 'Options that shape the line',
      body: 'type selects the prefix, scope is trimmed and wrapped in parentheses, and breaking inserts both the ! and the footer. Leave breakingDetail empty and the subject is repeated as the footer text. Whatever you put in body is inserted verbatim after a blank line, which is why the field asks for one line per paragraph.',
    },
    {
      heading: 'Refusals, warnings and privacy',
      body: 'An empty subject is rejected, as is a subject over 10,000 characters. A final first line longer than 72 characters is only flagged in a note; the message is still produced. The whole message is assembled in this tab with no request, so subjects naming private tickets or unreleased features stay on the machine.',
    },
  ],
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
    {
      title: 'Breaking change with its own footer text',
      input: 'Drop the page parameter from list endpoints',
      options: {
        type: 'feat',
        scope: 'api',
        breaking: true,
        breakingDetail: 'Use limit plus cursor instead of page.',
      },
    },
    {
      title: 'A fix with an explanatory body',
      input: 'Treat a 204 response as success',
      options: {
        type: 'fix',
        scope: 'http',
        body: 'Retries no longer flag an empty body as a failure.\nThe retry budget is unchanged.',
      },
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
  related: ['diff-text', 'markdown-table', 'semver', 'slugify'],
  status: 'stable',
};
