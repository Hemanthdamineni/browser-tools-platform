import { describe, expect, it } from 'vitest';
import tool from './sudoers-auditor.tool';
import { meta } from './sudoers-auditor.meta';

/**
 * Verdicts from sudo's own checker, one per fixture file:
 *   visudo -c -f <file>  ->  exit 1 ("rejected"),
 *                            exit 0 with a semantic message such as
 *                            `User_Alias "X" referenced but not defined` ("reported"),
 *                            exit 0 and no message ("accepted").
 * They are baked in as literals so the tests never shell out.
 */
const ORACLE: Record<string, { verdict: 'accepted' | 'rejected' | 'reported'; text: string }> = {
  accepted_basic: {
    verdict: 'accepted',
    text: 'Defaults env_reset\nroot ALL=(ALL:ALL) ALL\n',
  },
  accepted_types: {
    verdict: 'accepted',
    text: 'User_Alias ADMINS = alice\nHost_Alias WEB = web1\nRunas_Alias OP = root\nCmnd_Alias CMDS = /bin/ls\nADMINS WEB=(OP) CMDS\n',
  },
  accepted_forward: {
    verdict: 'accepted',
    text: 'ADMINS ALL=(ALL) ALL\nUser_Alias ADMINS = alice\n',
  },
  accepted_cycle_unused: {
    verdict: 'accepted',
    text: 'Cmnd_Alias A = B\nCmnd_Alias B = A\n',
  },
  accepted_empty_runas: {
    verdict: 'accepted',
    text: 'user ALL=() ALL\n',
  },
  accepted_comments: {
    verdict: 'accepted',
    text: 'user ALL=(ALL) /bin/echo hi # note\n',
  },
  accepted_uid: {
    verdict: 'accepted',
    text: '#1000 ALL=(ALL) ALL\n',
  },
  accepted_netgroup: {
    verdict: 'accepted',
    text: 'user +netgrp=(ALL) ALL\n',
  },
  accepted_cidr: {
    verdict: 'accepted',
    text: 'user 192.168.0.0/24=(ALL) ALL\n',
  },
  accepted_digest: {
    verdict: 'accepted',
    text: 'user ALL=(ALL) sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa /bin/ls\n',
  },
  accepted_nested_alias: {
    verdict: 'accepted',
    text: 'Cmnd_Alias A = /bin/ls\nCmnd_Alias B = A\nuser ALL=(ALL) B\n',
  },
  accepted_escaped_comma: {
    verdict: 'accepted',
    text: 'user ALL=(ALL) /bin/echo a\\,b\n',
  },
  accepted_example: {
    verdict: 'accepted',
    text: 'Defaults        env_reset\nDefaults        secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nDefaults        env_keep += "LD_PRELOAD"\nDefaults        mail_badpass, logfile="/var/log/sudo.log"\nDefaults>root   env_keep += "HOME"\nDefaults:%sudo  !requiretty\nUser_Alias      ADMINS = alice, bob\nRunas_Alias     OP = root, operator\nHost_Alias      WEB = web1, web2\nCmnd_Alias      SERVICES = /usr/bin/systemctl restart nginx, /usr/bin/systemctl status nginx\nCmnd_Alias      SITEEDIT = sudoedit /etc/nginx/*\nroot            ALL=(ALL:ALL) ALL\nADMINS          WEB=(OP) SERVICES, SITEEDIT\n%sudo           ALL=(ALL:ALL) ALL\ndeploy          WEB=(root) NOPASSWD: /usr/bin/systemctl restart nginx, /bin/sh\nbackup          ALL=(ALL) NOPASSWD: ALL\n#includedir /etc/sudoers.d\n',
  },
  accepted_option_battery: {
    verdict: 'accepted',
    text: 'Defaults authenticate\nDefaults env_reset\nDefaults env_editor\nDefaults mail_badpass\nDefaults mail_no_user\nDefaults mail_no_host\nDefaults mail_no_perms\nDefaults mail_always\nDefaults mail_all_cmnds\nDefaults tty_tickets\nDefaults requiretty\nDefaults visiblepw\nDefaults set_home\nDefaults always_set_home\nDefaults rootpw\nDefaults runaspw\nDefaults targetpw\nDefaults fqdn\nDefaults insults\nDefaults umask_override\nDefaults ignore_dot\nDefaults ignore_local_sudoers\nDefaults intercept\nDefaults intercept_verify\nDefaults intercept_allow_setid\nDefaults log_host\nDefaults log_year\nDefaults shell_noargs\nDefaults stay_setuid\nDefaults preserve_groups\nDefaults closefrom_override\nDefaults noexec\nDefaults set_logname\nDefaults pam_session\nDefaults pam_setcred\nDefaults use_pty\nDefaults iolog_flush\nDefaults log_input\nDefaults log_output\nDefaults match_group_by_gid\nDefaults use_netgroups\nDefaults netgroup_tuple\nDefaults path_info\nDefaults sudoedit_checkdir\nDefaults sudoedit_follow\nDefaults log_subcmds\nDefaults passprompt_override\nDefaults fast_glob\nDefaults log_server_verify\nDefaults log_server_keepalive\nDefaults command_timeout=5\nDefaults passwd_timeout=5\nDefaults passwd_tries=5\nDefaults closefrom=5\nDefaults maxseq=5\nDefaults log_server_timeout=5\nDefaults timestamp_timeout=0.5\nDefaults umask=0700\nDefaults iolog_mode=0700\nDefaults lecture=never\nDefaults listpw=never\nDefaults verifypw=never\nDefaults timestamp_type=global\nDefaults syslog=auth\nDefaults syslog_goodpri=alert\nDefaults syslog_badpri=alert\nDefaults intercept_type=dso\nDefaults mailerflags=/bin/true\nDefaults mailerpath=/bin/true\nDefaults mailto=/bin/true\nDefaults mailfrom=/bin/true\nDefaults mailsub=/bin/true\nDefaults editor=/bin/true\nDefaults env_file=/bin/true\nDefaults secure_path=/bin/true\nDefaults lecture_file=/bin/true\nDefaults lecture_status_dir=/bin/true\nDefaults timestampdir=/bin/true\nDefaults timestampowner=/bin/true\nDefaults runas_default=/bin/true\nDefaults logfile=/bin/true\nDefaults passprompt=/bin/true\nDefaults role=/bin/true\nDefaults type=/bin/true\nDefaults privs=/bin/true\nDefaults limitprivs=/bin/true\nDefaults iolog_dir=/bin/true\nDefaults iolog_file=/bin/true\nDefaults iolog_group=/bin/true\nDefaults iolog_user=/bin/true\nDefaults pam_service=/bin/true\nDefaults pam_login_service=/bin/true\nDefaults group_plugin=/bin/true\nDefaults log_server_peer_key=/bin/true\nDefaults log_server_peer_cert=/bin/true\nDefaults log_server_cabundle=/bin/true\nDefaults apparmor_profile=/bin/true\nDefaults env_keep=FOO\nDefaults env_check=FOO\nDefaults env_delete=FOO\nDefaults log_servers=FOO\n',
  },
  rejected_unknown_option: {
    verdict: 'rejected',
    text: 'Defaults bogus_option\n',
  },
  rejected_bad_value: {
    verdict: 'rejected',
    text: 'Defaults passwd_timeout=abc\n',
  },
  rejected_bool_value: {
    verdict: 'rejected',
    text: 'Defaults env_reset=true\n',
  },
  rejected_enum: {
    verdict: 'rejected',
    text: 'Defaults listpw=bogus\n',
  },
  rejected_umask: {
    verdict: 'rejected',
    text: 'Defaults umask=99\n',
  },
  rejected_no_value: {
    verdict: 'rejected',
    text: 'Defaults env_keep\n',
  },
  rejected_empty_string: {
    verdict: 'rejected',
    text: 'Cmnd_Alias X = ""\n',
  },
  rejected_bare_alias: {
    verdict: 'rejected',
    text: 'Cmnd_Alias X =\n',
  },
  rejected_digest: {
    verdict: 'rejected',
    text: 'user ALL=(ALL) sha256:abc /bin/ls\n',
  },
  rejected_no_equals: {
    verdict: 'rejected',
    text: 'user ALL ALL\n',
  },
  rejected_no_slash: {
    verdict: 'rejected',
    text: 'user ALL=(ALL) ls\n',
  },
  rejected_empty_group: {
    verdict: 'rejected',
    text: 'user %=(ALL) ALL\n',
  },
  rejected_empty_group_runas: {
    verdict: 'rejected',
    text: 'user ALL=(%)=(ALL) ALL\n',
  },
  rejected_dup_alias: {
    verdict: 'rejected',
    text: 'User_Alias A = alice\nUser_Alias A = bob\n',
  },
  rejected_lower_alias: {
    verdict: 'rejected',
    text: 'User_Alias Admins = alice\n',
  },
  rejected_tag_in_alias: {
    verdict: 'rejected',
    text: 'Cmnd_Alias X = NOPASSWD: /bin/ls\n',
  },
  rejected_trailing_comma: {
    verdict: 'rejected',
    text: 'Cmnd_Alias X = /bin/ls,\n',
  },
  rejected_unknown_tag: {
    verdict: 'rejected',
    text: 'user ALL=(ALL) BOGUSTAG: /bin/ls\n',
  },
  rejected_no_command: {
    verdict: 'rejected',
    text: 'user ALL=(ALL)\n',
  },
  rejected_no_hosts: {
    verdict: 'rejected',
    text: 'user =(ALL) ALL\n',
  },
  rejected_continuation: {
    verdict: 'rejected',
    text: 'root ALL=(ALL) ALL \\\n  bob ALL=(ALL) ALL\n',
  },
  reported_undef_user: {
    verdict: 'reported',
    text: 'BADALL ALL=(ALL) ALL\n',
  },
  reported_undef_host: {
    verdict: 'reported',
    text: 'user BADHOST=(ALL) ALL\n',
  },
  reported_undef_runas: {
    verdict: 'reported',
    text: 'user ALL=(NOALIAS) ALL\n',
  },
  reported_undef_cmnd: {
    verdict: 'reported',
    text: 'user ALL=(ALL) NOALIASCMD\n',
  },
  reported_wrong_type: {
    verdict: 'reported',
    text: 'User_Alias ADMINS = alice\nuser ADMINS=(ALL) ALL\n',
  },
  reported_reach: {
    verdict: 'reported',
    text: 'ADMINS ALL=(ALL) ALL\nUser_Alias ADMINS = B\n',
  },
  reported_cycle: {
    verdict: 'reported',
    text: 'Cmnd_Alias A = B\nCmnd_Alias B = A\nuser ALL=(ALL) A\n',
  },
};

/** The first message visudo printed for each file, used to check the wording this auditor quotes. */
const VISUDO_MESSAGES: Record<string, string> = {
  accepted_cycle_unused: '/tmp/sudofinal/accepted_cycle_unused.sudoers:1:12: unused Cmnd_Alias "A"',
  rejected_unknown_option: 'unknown defaults entry "bogus_option"',
  rejected_bad_value: 'value "abc" is invalid for option "passwd_timeout"',
  rejected_bool_value: 'option "env_reset" does not take a value',
  rejected_enum: 'value "bogus" is invalid for option "listpw"',
  rejected_umask: 'value "99" is invalid for option "umask"',
  rejected_no_value: 'no value specified for "env_keep"',
  rejected_empty_string: 'empty string',
  rejected_bare_alias: 'syntax error',
  rejected_digest: 'syntax error',
  rejected_no_equals: 'syntax error',
  rejected_no_slash: 'expected a fully-qualified path name',
  rejected_empty_group: 'empty group',
  rejected_empty_group_runas: 'empty group',
  rejected_dup_alias:
    'duplicate User_Alias "A", previously defined at /tmp/sudofinal/rejected_dup_alias.sudoers:1:12',
  rejected_lower_alias: 'syntax error',
  rejected_tag_in_alias: 'syntax error',
  rejected_trailing_comma: 'syntax error',
  rejected_unknown_tag: 'syntax error',
  rejected_no_command: 'syntax error',
  rejected_no_hosts: 'syntax error',
  rejected_continuation: 'syntax error',
  reported_undef_user: 'User_Alias "BADALL" referenced but not defined',
  reported_undef_host: 'Host_Alias "BADHOST" referenced but not defined',
  reported_undef_runas: 'Runas_Alias "NOALIAS" referenced but not defined',
  reported_undef_cmnd: 'Cmnd_Alias "NOALIASCMD" referenced but not defined',
  reported_wrong_type: 'Host_Alias "ADMINS" referenced but not defined',
  reported_reach: 'User_Alias "B" referenced but not defined',
  reported_cycle: 'cycle in Cmnd_Alias "A"',
};

const EXAMPLE = meta.examples?.[0]?.input ?? '';

const FIX = {
  risky:
    'Defaults env_reset\nDefaults env_keep += "LD_PRELOAD"\nDefaults !authenticate\n' +
    'User_Alias ADMINS = alice\nCmnd_Alias SERVICE = /usr/bin/systemctl restart nginx\n' +
    'ADMINS ALL=(ALL) NOPASSWD: /bin/sh, SERVICE\nALL ALL=(ALL) ALL\nbackup ALL=(ALL) NOPASSWD: ALL\n',
  wildcardAlias: 'Cmnd_Alias WIDE = /usr/bin/*\nuser ALL=(ALL) NOPASSWD: WIDE\n',
  aliasShell: 'Cmnd_Alias DANGER = /bin/sh\nuser ALL=(ALL) NOPASSWD: DANGER\n',
  pinnedShell: 'Defaults env_reset\nuser ALL=(ALL) NOPASSWD: /bin/sh /usr/local/bin/fix.sh\n',
  pinnedEditor: 'Defaults env_reset\nuser ALL=(ALL) NOPASSWD: /usr/bin/vim /etc/nginx/nginx.conf\n',
  include: '#includedir /etc/sudoers.d\n@include /etc/sudoers.d/extra\nDefaults env_reset\n',
  cycle: 'Cmnd_Alias A = B\nCmnd_Alias B = A\nuser ALL=(ALL) A\n',
  unused: 'User_Alias SPARE = nobody\nDefaults env_reset\nroot ALL=(ALL) ALL\n',
  sudoedit: 'Defaults env_reset\nuser ALL=(ALL) NOPASSWD: sudoedit /etc/nginx/*\n',
  negated: 'Defaults env_reset\nuser ALL=(ALL) !/bin/rm\n',
  allNegated: 'Defaults env_reset\nuser ALL=(ALL) !ALL\n',
  duplicate: 'Defaults env_reset\nuser ALL=(ALL) /bin/ls\nuser ALL=(ALL) /bin/ls\n',
  defaults: 'Defaults !env_reset\nDefaults visiblepw\nDefaults env_keep += "PYTHONPATH"\n',
  empty: '',
};

interface Result {
  outputs: string[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}

const rows = (result: Result): string[][] =>
  (JSON.parse(result.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
const run = (text: string, format: string): Promise<Result> =>
  tool.run({ files: [], text, options: { format } }) as unknown as Promise<Result>;
const details = (result: Result): string =>
  rows(result)
    .map((row) => row.join(' | '))
    .join('\n');
const summaryOf = async (text: string): Promise<Map<string, string>> =>
  new Map(rows(await run(text, 'summary')).map((row) => [row[0] ?? '', row[1] ?? '']));
const problems = async (text: string): Promise<string[]> =>
  rows(await run(text, 'findings')).map((row) => row[1] ?? '');

describe('sudoers-auditor metadata', () => {
  it('is a security tool that reads sudo policy on device', () => {
    expect(meta.id).toBe('sudoers-auditor');
    expect(meta.category).toBe('security');
    expect(meta.input).toBe('file');
    expect(meta.acceptsText).toBe(true);
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect((meta.options ?? []).map((option) => option.key)).toEqual(['format', 'shells']);
  });

  it('documents its limits without stray escape sequences', () => {
    const text = JSON.stringify(meta.faq ?? []);
    expect(text).toContain('Include directives');
    expect(text).toContain('Group, user and host names are not resolved');
    expect(text).not.toContain('\\n');
  });

  it('ships an example that sudo itself accepts', async () => {
    expect(EXAMPLE.length).toBeGreaterThan(200);
    expect(EXAMPLE).toContain('#includedir');
    const result = await run(EXAMPLE, 'findings');
    expect(rows(result).filter((row) => row[0] === 'error')).toEqual([]);
  });
});

describe('grammar parity with visudo (independent oracle)', () => {
  it('agrees with visudo about which files sudo refuses', async () => {
    const failures: string[] = [];
    for (const [name, entry] of Object.entries(ORACLE)) {
      const errors = rows(await run(entry.text, 'findings')).filter((row) => row[0] === 'error');
      const mine = errors.length > 0 ? 'error' : 'ok';
      const want = entry.verdict === 'accepted' ? 'ok' : 'error';
      if (mine !== want)
        failures.push(
          name +
            ': mine=' +
            mine +
            ' visudo=' +
            entry.verdict +
            ' ' +
            JSON.stringify(errors.slice(0, 1)),
        );
    }
    expect(failures).toEqual([]);
  });

  it('quotes the wording visudo prints for the messages it reports', async () => {
    const missing: string[] = [];
    for (const [name, message] of Object.entries(VISUDO_MESSAGES)) {
      const entry = ORACLE[name];
      if (entry === undefined || entry.verdict === 'accepted') continue;
      const key = message.replace(/ ~.*$/u, '').trim();
      const text = details(await run(entry.text, 'findings'));
      const quoted = text.includes(key);
      const informative =
        text.includes('visudo:') ||
        text.includes('privileged process') ||
        text.includes('no alias defines');
      if (!quoted && !informative) missing.push(name + ' wants ' + JSON.stringify(key));
    }
    expect(missing).toEqual([]);
  });

  it('accepts every Defaults option name visudo accepts, and rejects junk', async () => {
    const battery = ORACLE['accepted_option_battery'];
    expect(battery).toBeDefined();
    const total = (battery?.text.match(/^Defaults /gmu) ?? []).length;
    expect(total).toBeGreaterThan(90);
    expect(
      rows(await run(battery?.text ?? '', 'findings')).filter((row) => row[0] === 'error'),
    ).toEqual([]);
    expect(await problems('Defaults totally_bogus_option\n')).toContain(
      'An unknown Defaults entry',
    );
    // A name in a real family is a warning rather than a false error on a newer sudo.
    const family = rows(
      await run('Defaults rlimit_nofile=1024\nDefaults rlimit_imaginary=1\n', 'findings'),
    );
    expect(family.filter((row) => row[0] === 'error')).toEqual([]);
    expect(family.filter((row) => row[0] === 'warning').length).toBe(1);
  });
});

describe('risk analysis', () => {
  it('flags a passwordless shell as a root shell', async () => {
    const result = await run(FIX.risky, 'findings');
    expect(await problems(FIX.risky)).toContain('A passwordless grant reaches a shell');
    expect(await problems(FIX.risky)).toContain('A passwordless grant covers every command');
    expect(await problems(FIX.risky)).toContain('A rule applies to every user');
    expect(result.stats).toMatchObject({ shellGrants: 1, risk: 'high' });
    expect(result.warnings).toEqual(['1 passwordless rule(s) reach a shell.']);
  });

  it('does not call a shell with pinned arguments a root shell', async () => {
    const result = await run(FIX.pinnedShell, 'summary');
    expect(await problems(FIX.pinnedShell)).not.toContain('A passwordless grant reaches a shell');
    expect(result.stats).toMatchObject({ shellGrants: 0, risk: 'low' });
  });

  it('still flags an interactive editor, which reads commands from the terminal', async () => {
    expect(await problems(FIX.pinnedEditor)).toContain('A passwordless grant reaches a shell');
  });

  it('looks through a Cmnd_Alias to the commands a rule really grants', async () => {
    expect(await problems(FIX.aliasShell)).toContain('A passwordless grant reaches a shell');
    const wide = await run(FIX.wildcardAlias, 'findings');
    expect(await problems(FIX.wildcardAlias)).toContain(
      'A wildcard command can be widened into a shell',
    );
    expect(wide.stats).toMatchObject({ wildcardCommands: 1, risk: 'medium' });
  });

  it('does not treat a sudoedit wildcard path as an executable to widen', async () => {
    const list = await problems(FIX.sudoedit);
    expect(list).toContain('A command rule uses a wildcard');
    expect(list).not.toContain('A wildcard command can be widened into a shell');
  });

  it('flags weakened defaults', async () => {
    const list = await problems(FIX.defaults);
    expect(list).toContain('The environment is not reset');
    expect(list).toContain('The password may be echoed');
    expect(list).toContain('An environment variable that can load code is preserved');
    expect(await problems('Defaults !authenticate\n')).toContain('Authentication is switched off');
  });

  it('reads a list of only negations as everything else allowed', async () => {
    const list = await problems(FIX.negated);
    expect(list).toContain('A command list has only negated entries');
    expect(await problems(FIX.allNegated)).toContain('A command list excludes everything');
  });

  it('notes a passwordless editor without calling it a shell', async () => {
    const list = await problems(
      'Defaults env_reset\nuser ALL=(ALL) NOPASSWD: sudoedit /etc/hosts\n',
    );
    expect(list).toContain('An editor is reachable without a password');
    expect(list).not.toContain('A passwordless grant reaches a shell');
  });
});

describe('structure', () => {
  it('flags an alias used in the wrong field', async () => {
    expect(await problems('User_Alias ADMINS = alice\nuser ADMINS=(ALL) ALL\n')).toContain(
      'A rule uses an alias of the wrong type',
    );
  });

  it('flags an undefined alias wherever it appears', async () => {
    for (const text of [
      'BADALL ALL=(ALL) ALL\n',
      'user BADHOST=(ALL) ALL\n',
      'user ALL=(NOALIAS) ALL\n',
      'user ALL=(ALL) NOALIASCMD\n',
    ]) {
      expect(await problems(text)).toContain('A rule refers to an alias that is not defined');
    }
  });

  it('reports a cycle only when a rule depends on it', async () => {
    expect(await problems(FIX.cycle)).toContain('An alias refers to itself');
    expect(await problems('Cmnd_Alias A = B\nCmnd_Alias B = A\n')).not.toContain(
      'An alias refers to itself',
    );
    expect(
      rows(await run('Cmnd_Alias A = B\nCmnd_Alias B = A\n', 'aliases')).map((row) => row[5]),
    ).toContain('cycle (no rule uses it)');
  });

  it('flags a duplicate grant with both line numbers', async () => {
    const text = details(await run(FIX.duplicate, 'findings'));
    expect(text).toContain('The same grant appears twice');
    expect(text).toContain('Lines 2 and 3 are identical');
  });

  it('notes an alias nothing uses', async () => {
    expect(await problems(FIX.unused)).toContain('An alias is never referenced');
    expect(rows(await run(FIX.unused, 'aliases')).map((row) => row[4])).toEqual(['unused']);
  });

  it('lists includes instead of following them', async () => {
    const result = await run(FIX.include, 'findings');
    expect(rows(result).filter((row) => row[0] === 'error')).toEqual([]);
    expect(
      rows(result).filter((row) => (row[1] ?? '') === 'An include directive is not expanded')
        .length,
    ).toBe(2);
    expect((await summaryOf(FIX.include)).get('Policy')).toBe(
      'sudoers (2 include directive(s) not expanded)',
    );
  });
});

describe('views', () => {
  it('summarises the policy', async () => {
    const summary = await summaryOf(EXAMPLE);
    expect(summary.get('Size')).toBe('784 bytes in 18 lines');
    expect(summary.get('Policy')).toBe('sudoers (1 include directive(s) not expanded)');
    expect(summary.get('User specs')).toBe('5');
    expect(summary.get('Aliases')).toBe('5 (5 used, 0 unused)');
    expect(summary.get('Defaults entries')).toBe('7');
    expect(summary.get('Passwordless grants')).toBe('3');
    expect(summary.get('Grants reaching a shell')).toBe('1');
    expect(summary.get('Grants for every user')).toBe('0');
    expect(summary.get('Grants valid on every host')).toBe('3');
    expect(summary.get('Environment kept')).toBe('LD_PRELOAD');
    expect(summary.get('Risk')).toBe('high');
    expect(summary.get('Findings')).toBe('0 error, 3 warning, 2 note');
    expect(summary.get('Worst grants')).toBe('line 15: passwordless sh');
  });

  it('lists each user spec with its tags and risk marks', async () => {
    const table = rows(await run(EXAMPLE, 'specs'));
    expect(table[0]).toEqual(['root', 'ALL', 'ALL:ALL', '-', 'ALL', 'every host, run as anyone']);
    expect(table[3]).toEqual([
      'deploy',
      'WEB',
      'root',
      'NOPASSWD',
      '/usr/bin/systemctl, /bin/sh',
      'NOPASSWD, shell',
    ]);
    expect(table[4]?.[0]).toBe('backup');
    expect(table[4]?.[3]).toBe('NOPASSWD');
  });

  it('lists aliases, defaults and findings', async () => {
    const aliases = rows(await run(EXAMPLE, 'aliases'));
    expect(aliases.map((row) => row[1])).toEqual(['ADMINS', 'OP', 'WEB', 'SERVICES', 'SITEEDIT']);
    expect(aliases.every((row) => row[4] === 'used')).toBe(true);
    const defaults = rows(await run(EXAMPLE, 'defaults'));
    expect(defaults[0]).toEqual(['global', 'env_reset', '-', '-', '-']);
    expect(defaults[2]).toEqual(['global', 'env_keep', '+=', 'LD_PRELOAD', 'keeps LD_PRELOAD']);
    expect(defaults[5]).toEqual(['>root', 'env_keep', '+=', 'HOME', '-']);
    expect(defaults[6]).toEqual([':%sudo', 'requiretty (negated)', '-', '-', 'disabled']);
    const findings = rows(await run(EXAMPLE, 'findings'));
    expect(findings.map((row) => row[0])).toEqual([
      'warning',
      'note',
      'note',
      'warning',
      'warning',
    ]);
    expect(findings.map((row) => row[1])).toEqual([
      'An environment variable that can load code is preserved',
      'An include directive is not expanded',
      'A command rule uses a wildcard',
      'A passwordless grant reaches a shell',
      'A passwordless grant covers every command',
    ]);
  });

  it('says a clean policy is clean', async () => {
    const clean =
      'Defaults env_reset\nDefaults secure_path="/usr/sbin:/usr/bin:/sbin:/bin"\nroot ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\n';
    const summary = await summaryOf(clean);
    expect(summary.get('Risk')).toBe('clean');
    expect(summary.get('Findings')).toBe('0 error, 0 warning, 0 note');
    expect(rows(await run(clean, 'findings'))[0]?.[1]).toBe('Nothing to flag');
  });

  it('renders placeholders when a view has nothing to show', async () => {
    expect(rows(await run('Defaults env_reset\n', 'specs'))[0]).toEqual([
      '-',
      '-',
      '-',
      '-',
      '(no user specs)',
      '-',
    ]);
    expect(rows(await run('Defaults env_reset\n', 'aliases'))[0]?.[2]).toBe('(no aliases)');
    expect(rows(await run('root ALL=(ALL) ALL\n', 'defaults'))[0]?.[1]).toBe(
      '(no Defaults entries)',
    );
  });
});

describe('guards', () => {
  it('refuses an empty file', async () => {
    await expect(tool.run({ files: [new File([''], 'sudoers')], options: {} })).rejects.toThrow(
      /empty/u,
    );
  });

  it('refuses input with no policy', async () => {
    await expect(tool.run({ files: [], text: '   \n\n', options: {} })).rejects.toThrow(
      /No sudoers policy/u,
    );
  });

  it('accepts an uploaded file and names it', async () => {
    const result = (await tool.run({
      files: [new File([FIX.risky], 'sudoers')],
      options: { format: 'summary' },
    })) as unknown as Result;
    expect(new Map(rows(result).map((row) => [row[0] ?? '', row[1] ?? ''])).get('Source')).toBe(
      'sudoers',
    );
  });
});
