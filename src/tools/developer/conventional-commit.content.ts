/**
 * Editorial content for the conventional-commit tool page.
 *
 * Kept out of ``conventional-commit.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
