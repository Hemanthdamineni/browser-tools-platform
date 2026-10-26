/**
 * Editorial content for the iptables-ruleset-auditor tool page.
 *
 * Kept out of ``iptables-ruleset-auditor.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the tool reads',
      body: 'The input is iptables-save output \u2014 *table markers, :CHAIN POLICY [packets:bytes] declarations and -A rules \u2014 or a plain list of iptables commands including -A, -P, -N, -F and -D. nftables syntax is detected and refused with an explanation rather than misparsed. Input is capped at 8 MB, and an empty or unrecognisable file is rejected before analysis.',
    },
    {
      heading: 'Choosing the output view',
      body: 'The format option selects the table you get: a ruleset summary, a chain-and-policy listing, a rule inventory, the exposed-port report, or the raw findings list. The analysis underneath is the same whichever you pick, and a note appears once findings exceed the display cap.',
    },
    {
      heading: 'Chain policies and shadowed rules',
      body: 'Each chain is shown with its policy, rule count and verdict mix, and a chain whose policy is ACCEPT but which ends in DROP rules is flagged as fail-open, because anything falling off the end is accepted. A rule is shadowed when an earlier unconditional DROP or REJECT means it can never match, and the report names the shadowing rule number.',
    },
    {
      heading: 'Exposed ports, and where this runs',
      body: 'A port is listed as exposed when an ACCEPT rule in INPUT or FORWARD matches it without restricting source address or interface. Ports on your sensitive list \u2014 SSH, databases, Redis and friends by default \u2014 come first, and a shadowed port is marked when an earlier blanket rule already killed it. Every rule is checked against iptables\u2019 own grammar, so the errors read like iptables\u2019 own. Nothing is executed, applied or uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which firewall formats can it read?',
      a: 'The output of iptables-save (with *table, :CHAIN POLICY [packets:bytes] and -A lines) and a plain list of iptables commands such as -A INPUT -p tcp --dport 22 -j ACCEPT, -P, -N, -F and -D. nftables syntax is recognised and refused with an explanation rather than being misread as iptables, because the two grammars only look alike.',
    },
    {
      q: 'Where do the error messages come from?',
      a: 'Every rule is run through the same grammar iptables uses, so a rule that iptables refuses is reported as an error with the message iptables prints — for example unknown option "--dport" when a port is given without -p tcp, or Can\'t use --out-interface with INPUT. Warnings that need kernel state to confirm, such as a policy name no kernel accepts, are labelled as warnings rather than errors.',
    },
    {
      q: 'What counts as an exposed port?',
      a: 'A port is listed as exposed when an ACCEPT rule in an INPUT or FORWARD chain matches it and that rule does not restrict the source address or interface. Ports on your sensitive list are shown first, and a port is marked shadowed when an earlier unconditional DROP or REJECT rule in the same chain means the ACCEPT can never be reached.',
    },
    {
      q: 'Is anything applied to this machine?',
      a: 'No. The ruleset is read as text in your browser: nothing is uploaded, no iptables command is run, and no network request is made. The analysis is a static reading of the rules you paste.',
    },
  ],
} as const;
