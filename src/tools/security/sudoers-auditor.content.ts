/**
 * Editorial content for the sudoers-auditor tool page.
 *
 * Kept out of ``sudoers-auditor.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the auditor reads',
      body: 'Paste /etc/sudoers or a drop-in from /etc/sudoers.d, or drop the file in. The parser handles Defaults lines and their scopes, all four alias types, user specs with runas lists, tags and command lists, continuation backslashes, and includes. Mistakes are quoted in the wording visudo prints.',
    },
    {
      heading: 'The five output views',
      body: 'The Output selector switches between the policy summary, the parsed user specs, the aliases with each member and its line number, the Defaults entries grouped by scope, and the findings list. The summary is the overview; the other views let you check the parser against the file you pasted.',
    },
    {
      heading: 'What gets flagged as risky',
      body: 'A finding is raised for a passwordless grant that reaches a shell, editor or interpreter, since any of those can run commands as the target user. Also flagged: ALL-command grants, wildcards whose basename pattern covers such a command, env_keep variables like LD_PRELOAD, and command lists of only negated entries.',
    },
    {
      heading: 'Tuning the shell-escape list',
      body: 'The Commands that count as a shell escape box lists the program names treated as root-equivalent, from sh and vim to systemctl and docker. Trim it to your environment to cut noise, or add your own interpreters. Emptying the box falls back to the built-in list rather than disabling the check.',
    },
    {
      heading: 'What a browser cannot resolve',
      body: 'Includes are listed but never followed, so /etc/sudoers.d is not read from a dropped main file, and group, user and host names are not resolved. Input is capped at 8 MB, with further limits on specs and findings. Parsing is text-only in this tab: nothing is executed, uploaded or sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'Is it safe to paste a sudoers file here?',
      a: 'Yes. Everything is parsed as text in your browser: nothing is uploaded, no sudo command is run and no network request is made. That matters more than usual with sudoers, because the file describes exactly which accounts can become root on which hosts.',
    },
    {
      q: 'Where do the syntax messages come from?',
      a: 'The parser follows the same grammar sudo does, so a line sudo refuses is reported as an error with the wording visudo prints, such as unknown defaults entry "bogus_option", value "abc" is invalid for option "passwd_timeout", syntax error, or User_Alias "BADALL" referenced but not defined. Note that visudo reports undefined alias references without failing the parse, so this auditor counts them as errors while still showing the rest of the file.',
    },
    {
      q: 'What can a browser not check?',
      a: 'Include directives (#include and @includedir) are listed but never followed, because the auditor cannot read /etc/sudoers.d from a dropped file. Group, user and host names are not resolved either, so a rule naming a group that does not exist is accepted rather than guessed at. Those limits are reported as notes, and the effective policy is the one written in the text you paste.',
    },
    {
      q: 'What makes a grant risky?',
      a: 'A passwordless grant that reaches a shell, editor or interpreter, because any of those can run arbitrary commands as the target user. Also: a grant covering ALL commands, a wildcard that can be widened, an env_keep variable such as LD_PRELOAD that loads code into the privileged process, a command list of only negated entries (sudoers then allows everything else), and Defaults !authenticate.',
    },
  ],
} as const;
