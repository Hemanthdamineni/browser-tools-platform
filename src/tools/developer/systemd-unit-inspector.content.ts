/**
 * Editorial content for the systemd-unit-inspector tool page.
 *
 * Kept out of ``systemd-unit-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the inspector reads out of a unit file',
      body: 'Paste a unit file — or drop one from /etc/systemd/system — and it is parsed into its sections and directives, with comments skipped, blank lines ignored and backslash continuations joined so a wrapped ExecStart reads as one value. Every directive keeps the line it came from. Five output views present the same parse differently: a summary of the unit, the directives by line, the ordering, requirement and install dependencies, a hardening audit, and the findings. The counts at the top report lines read, directives, sections, dependency directives, continuations and how many errors, warnings and notes were found.',
    },
    {
      heading: 'The mistakes systemd actually refuses',
      body: 'Errors are reserved for the things that stop systemd loading the unit at all: a line with no equals sign, a directive sitting outside any section, a key that is not a known directive, a service with nothing to run, more than one ExecStart without Type=oneshot, and Restart=always on a oneshot service. Unknown keys are reported as notes rather than errors because new systemd releases add directives, and keys beginning with X- are treated as the unit author’s own and never flagged. Repeated single-value keys load without any complaint from systemd, so they surface as a warning that only one value survives, not as a failure.',
    },
    {
      heading: 'Dependencies and the way ExecStart is tokenised',
      body: 'The dependency view separates ordering keys such as After and Before from requirement keys such as Requires and Wants, and from install targets like WantedBy, so you can see at a glance how the unit slots into the boot or shutdown sequence. A unit named in one of those directives that is neither well known nor defined in the pasted text is marked unresolvable rather than missing, which keeps a single file’s inspection honest. Command lines are tokenised the way systemd splits them, and an unclosed quote is reported instead of guessed at.',
    },
    {
      heading: 'Bounds and privacy',
      body: 'Only the first twenty thousand lines are parsed and the directive and dependency tables are capped at two thousand rows, with a note when either bound is reached; input over two megabytes is refused outright. You can name the unit when pasting so its type is inferred from the .service, .timer, .socket or other suffix, otherwise the sections decide. Nothing is executed, installed or loaded, and no other unit file on the system is read — the analysis is a local parse of the text you provide, and the page makes no network request.',
    },
  ],
  faq: [
    {
      q: 'Does this run systemd or check the live system?',
      a: 'No. The text is parsed on your device and nothing is executed, installed or loaded. The rules it applies are the ones systemd itself applies when it loads a unit file, so the errors it names are the same errors journalctl would show as "ignoring" or "Refusing" lines.',
    },
    {
      q: 'Why is a repeated key only a warning?',
      a: 'Because systemd does not complain about it. Two Description= lines load without any message, and only one value survives. The inspector points the repetition out rather than pretending systemd rejects it, and it knows which directives are meant to repeat, such as ExecStart on a oneshot service, Environment, and the install targets.',
    },
    {
      q: 'What counts as an unknown key?',
      a: "A key in [Unit], [Service], [Socket], [Timer], [Path] or [Install] that is not in the inspector's table of systemd directives. Keys beginning with X- are your own and are never flagged. Because new systemd versions add directives, these are reported as notes rather than errors.",
    },
    {
      q: 'Can it follow dependencies into other unit files?',
      a: 'No, and it says so. A unit named in After=, Requires= or WantedBy= that is not well known and not defined in the pasted text is marked as unresolvable, so you never get a false "missing unit" verdict from a file that was inspected on its own.',
    },
  ],
} as const;
