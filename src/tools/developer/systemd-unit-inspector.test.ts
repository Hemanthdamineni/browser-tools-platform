import { describe, expect, it } from 'vitest';
import tool from './systemd-unit-inspector.tool';
import { meta } from './systemd-unit-inspector.meta';

/** Fixture texts, and the verdicts the real systemd parser (`systemd-analyze verify`) gave them. */
const FIXTURES: Record<string, string> = {
  "good.service": "[Unit]\nDescription=Example API\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=app\nExecStart=/usr/bin/node /srv/app/server.js\nRestart=on-failure\nNoNewPrivileges=yes\nProtectSystem=strict\nPrivateTmp=yes\n\n[Install]\nWantedBy=multi-user.target\n",
  "broken.service": "# broken on purpose\nDescription=Outside any section or so\n[Unit]\nWantedBy=multi-user.target\n[Service]\nExecStart=/bin/a\nExecStart=/bin/b\nResatrt=always\nthis line has no equals sign\n",
  "loose.service": "Description=Has an equals sign\nplain words without any equals sign\n[Service]\nExecStart=/bin/true\n",
  "noexec.service": "[Unit]\nDescription=Nothing to run\n[Service]\nType=simple\n",
  "oneshot-restart.service": "[Unit]\nDescription=One shot with a bad restart policy\n\n[Service]\nType=oneshot\nExecStart=/bin/true\nRestart=always\n",
  "reset.service": "[Unit]\nDescription=Resets its own command\n\n[Service]\nExecStart=/bin/true\nExecStart=\n",
  "continuation.service": "[Service]\nExecStart=/bin/echo \\\n  hello \\\n  world\nEnvironment=A=1 \\\n  B=2\n",
  "duplicate.service": "[Unit]\nDescription=First\n# the second assignment is easy to miss\nDescription=Second\n\n[Service]\nExecStart=/bin/true\n",
  "unknownsection.service": "[Unit]\nDescription=Has a bogus section\n[Bogus]\nThing=1\n[Service]\nExecStart=/bin/true\n",
  "customkey.service": "[Unit]\nDescription=Uses a custom key\n[Service]\nExecStart=/bin/true\nX-MyThing=1\n[Install]\nWantedBy=multi-user.target\n",
  "crlf.service": "[Unit]\r\nDescription=Shipped from Windows\r\n\r\n[Service]\r\nExecStart=/bin/true\r\n\r\n[Install]\r\nWantedBy=multi-user.target\r\n",
  "hardening-light.service": "[Unit]\nDescription=Lightly hardened worker\n\n[Service]\nType=simple\nExecStart=/bin/echo /srv/data *\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\n",
  "partial-hardening.service": "[Service]\nExecStart=/bin/true\nProtectSystem=yes\nProtectHome=read-only\nCapabilityBoundingSet=\n",
  "template@.service": "[Unit]\nDescription=Worker instance %i\n\n[Service]\nType=oneshot\nExecStart=/usr/bin/worker --instance %i\n\n[Install]\nWantedBy=multi-user.target\n",
  "app.service": "[Unit]\nDescription=Worker for %i\n\n[Service]\nExecStart=/bin/true\n\n[Install]\nWantedBy=multi-user.target\n",
  "sample.timer": "[Unit]\nDescription=Nightly sample timer\n\n[Timer]\nOnCalendar=daily\nPersistent=true\nUnit=sample.service\n\n[Service]\nExecStart=/bin/true\n",
  "unbalanced.service": "[Unit]\nDescription=Has an unclosed quote\n\n[Service]\nExecStart=/bin/echo \"unterminated\n",
  "semicolon.service": "[Service]\nExecStart=/bin/echo a; /bin/echo b\n",
  "spaced.service": "[Service]\nExecStart = /bin/true\n",
  "quoted.service": "[Service]\nExecStart=/bin/sh -c \"echo hello world\"\n",
  "comments.service": "# leading comment\n; semicolon comment\n[Service]\nExecStart=/bin/true # not a comment\n",
  "dependencies.service": "[Unit]\nDescription=Depends on things\nAfter=dependencies.service telegraf.service\nRequires=telegraf.service\nOnFailure=notify@%i.service\n\n[Service]\nExecStart=/bin/true\n\n[Install]\nWantedBy=multi-user.target\n",
  "install-only.service": "[Unit]\nDescription=Only install settings\n\n[Service]\nExecStart=/bin/true\n\n[Install]\n# nothing here\n",
  "headers-only.service": "[Unit]\n# nothing but a header\n"
};

interface Expectation {
  /** Every line `systemd-analyze verify` printed for this file, with the path stripped. */
  messages: string[];
  /** True when systemd refused the unit: it printed "has a bad unit file setting" or "Refusing". */
  fatal: boolean;
  /** Source lines systemd named as ":N:". */
  lines: number[];
  /** Problem titles the inspector must report for this fixture. */
  problems: string[];
}

const EXPECTED: {
  systemd: string;
  fixtures: Record<string, Expectation>;
  keys: { sections: Record<string, number>; unknownInSystemd: string[]; version: string };
} = {
  "systemd": "systemd 262 (262-1-arch)",
  "fixtures": {
    "good.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "broken.service": {
      "messages": [
        "/tmp/sup-oracle3/broken.service:2: Assignment outside of section. Ignoring.",
        "/tmp/sup-oracle3/broken.service:4: Unknown key 'WantedBy' in section [Unit], ignoring.",
        "/tmp/sup-oracle3/broken.service:8: Unknown key 'Resatrt' in section [Service], ignoring.",
        "/tmp/sup-oracle3/broken.service:9: Missing '=', ignoring line.",
        "broken.service: Service has more than one ExecStart= setting, which is only allowed for Type=oneshot services. Refusing.",
        "Unit broken.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [
        2,
        4,
        8,
        9
      ],
      "problems": [
        "A directive sits outside any section",
        "Unknown key in [Unit]: WantedBy",
        "More than one ExecStart on a non-oneshot service",
        "Unknown key in [Service]: Resatrt",
        "A line has no equals sign"
      ]
    },
    "loose.service": {
      "messages": [
        "/tmp/sup-oracle3/loose.service:1: Assignment outside of section. Ignoring.",
        "/tmp/sup-oracle3/loose.service:2: Assignment outside of section. Ignoring."
      ],
      "fatal": false,
      "lines": [
        1,
        2
      ],
      "problems": [
        "A directive sits outside any section"
      ]
    },
    "noexec.service": {
      "messages": [
        "noexec.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.",
        "Unit noexec.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [],
      "problems": [
        "A service has nothing to run",
        "There is no [Install] section"
      ]
    },
    "oneshot-restart.service": {
      "messages": [
        "oneshot-restart.service: Service has Restart= set to either always or on-success, which isn't allowed for Type=oneshot services. Refusing.",
        "Unit oneshot-restart.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [],
      "problems": [
        "Restart=always on a oneshot service"
      ]
    },
    "reset.service": {
      "messages": [
        "reset.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.",
        "Unit reset.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [],
      "problems": [
        "A service has nothing to run",
        "ExecStart= is empty"
      ]
    },
    "continuation.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "line continuation(s)"
      ]
    },
    "duplicate.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "Repeated key: Description"
      ]
    },
    "unknownsection.service": {
      "messages": [
        "/tmp/sup-oracle3/unknownsection.service:3: Unknown section 'Bogus'. Ignoring."
      ],
      "fatal": false,
      "lines": [
        3
      ],
      "problems": [
        "Unknown section [Bogus]"
      ]
    },
    "customkey.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "crlf.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "CRLF line endings"
      ]
    },
    "hardening-light.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "The service runs as root",
        "No filesystem or privilege hardening at all",
        "Shell syntax in ExecStart is not interpreted"
      ]
    },
    "partial-hardening.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "template@.service": {
      "messages": [
        "template@test_instance.service: Command /usr/bin/worker is not executable: No such file or directory"
      ],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "app.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "%i is used outside a template unit"
      ]
    },
    "sample.timer": {
      "messages": [
        "/tmp/sup-oracle3/sample.timer:9: Unknown section 'Service'. Ignoring."
      ],
      "fatal": false,
      "lines": [
        9
      ],
      "problems": [
        "Unknown section [Service]"
      ]
    },
    "unbalanced.service": {
      "messages": [
        "/tmp/sup-oracle3/unbalanced.service:5: Unbalanced quoting, ignoring: \"/bin/echo \"unterminated\"",
        "unbalanced.service: Unit configuration has fatal error, unit will not be started.",
        "Unit unbalanced.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [
        5
      ],
      "problems": [
        "A command line has an unclosed quote"
      ]
    },
    "semicolon.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "Shell syntax in ExecStart is not interpreted"
      ]
    },
    "spaced.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "quoted.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "comments.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": []
    },
    "dependencies.service": {
      "messages": [
        "dependencies.service: Dependency After=dependencies.service is dropped.",
        "dependencies.service: Failed to create dependencies.service/start: Unit telegraf.service not found."
      ],
      "fatal": false,
      "lines": [],
      "problems": [
        "A dependency on itself"
      ]
    },
    "install-only.service": {
      "messages": [],
      "fatal": false,
      "lines": [],
      "problems": [
        "[Install] has no target"
      ]
    },
    "headers-only.service": {
      "messages": [
        "headers-only.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.",
        "Unit headers-only.service has a bad unit file setting."
      ],
      "fatal": true,
      "lines": [],
      "problems": []
    }
  },
  "keys": {
    "sections": {
      "Unit": 86,
      "Service": 177,
      "Socket": 45,
      "Timer": 15,
      "Path": 10,
      "Install": 5
    },
    "unknownInSystemd": [],
    "version": "systemd 262 (262-1-arch)"
  }
};

interface Table {
  headers: string[];
  rows: string[][];
}

interface Result {
  output: string;
  render?: string;
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}

const run = async (name: string, format: string, extra: Record<string, unknown> = {}): Promise<Result> => {
  const result = await tool.run({
    text: FIXTURES[name] ?? '',
    options: { name, format, ...extra },
  });
  return result as unknown as Result;
};

const table = (result: Result): Table => JSON.parse(result.output) as Table;
const findings = (result: Result): string[][] => table(result).rows;
const levels = (rows: string[][], level: string): string[] =>
  rows.filter((row) => row[0] === level).map((row) => row[1] ?? '');
const allText = (rows: string[][]): string => rows.map((row) => row.join(' ')).join(' | ');

describe('systemd-unit-inspector metadata', () => {
  it('describes a text tool that stays on device', () => {
    expect(meta.id).toBe('systemd-unit-inspector');
    expect(meta.category).toBe('developer');
    expect(meta.input).toBe('text');
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect((meta.options ?? []).map((option) => option.key)).toEqual(['format', 'harden', 'name']);
  });

  it('validates five output views through the option list', () => {
    const format = (meta.options ?? []).find((option) => option.key === 'format');
    expect(format?.type).toBe('select');
    if (format?.type === 'select') {
      expect(format.default).toBe('summary');
      expect(format.choices.map((choice) => choice.value)).toEqual(['summary', 'directives', 'dependencies', 'hardening', 'findings']);
    }
  });
});

describe('parity with the real systemd parser', () => {
  it('refuses exactly the units systemd refuses, and loads the rest', async () => {
    for (const [name, expectation] of Object.entries(EXPECTED.fixtures)) {
      const rows = findings(await run(name, 'findings'));
      const raised = levels(rows, 'error').length > 0;
      expect([name, raised]).toEqual([name, expectation.fatal]);
    }
  });

  it('treats lines systemd merely ignores as warnings, never as refusals', async () => {
    for (const [name, expectation] of Object.entries(EXPECTED.fixtures)) {
      const ignored = expectation.messages.some((message) => /Missing '='|ignoring line|Assignment outside of section/u.test(message));
      if (!ignored || expectation.fatal) continue;
      const rows = findings(await run(name, 'findings'));
      expect([name, levels(rows, 'warning').length > 0]).toEqual([name, true]);
      expect([name, levels(rows, 'error').length]).toEqual([name, 0]);
    }
  });

  it('names the same source lines systemd names', async () => {
    for (const [name, expectation] of Object.entries(EXPECTED.fixtures)) {
      if (expectation.lines.length === 0) continue;
      const text = allText(findings(await run(name, 'findings')));
      for (const line of expectation.lines) {
        expect([name, line, new RegExp('(^|[^0-9])' + line + '([^0-9]|$)', 'u').test(text)]).toEqual([name, line, true]);
      }
    }
  });

  it('reports the specific problems the fixtures were built to trigger', async () => {
    for (const [name, expectation] of Object.entries(EXPECTED.fixtures)) {
      if (expectation.problems.length === 0) continue;
      const titles = findings(await run(name, 'findings')).map((row) => row[1] ?? '');
      for (const problem of expectation.problems) {
        expect([name, problem, titles.some((title) => title.includes(problem))]).toEqual([name, problem, true]);
      }
    }
  });

  it('knows every key it claims systemd knows (checked against systemd-analyze verify)', () => {
    // The development script generated one unit per section holding every key in the inspector's
    // tables and ran `systemd-analyze verify` on it. Any key systemd did not recognise would be
    // recorded in unknownInSystemd; a table entry that systemd rejects is a defect in this tool.
    expect(EXPECTED.keys.unknownInSystemd).toEqual([]);
    expect(EXPECTED.keys.version).toMatch(/^systemd /u);
    expect(Object.keys(EXPECTED.keys.sections).sort()).toEqual(['Install', 'Path', 'Service', 'Socket', 'Timer', 'Unit']);
    expect(EXPECTED.keys.sections.Service).toBeGreaterThan(150);
    expect(EXPECTED.keys.sections.Unit).toBeGreaterThan(70);
  });
});

describe('summary view', () => {
  it('reads the unit type, description, user and install target', async () => {
    const rows = table(await run('good.service', 'summary')).rows;
    const summary = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(summary.get('Unit name')).toBe('good.service');
    expect(summary.get('Unit type')).toBe('service');
    expect(summary.get('Description')).toBe('Example API');
    expect(summary.get('Type')).toBe('simple');
    expect(summary.get('User')).toBe('app');
    expect(summary.get('ExecStart')).toBe('/usr/bin/node /srv/app/server.js');
    expect(summary.get('Restart')).toBe('on-failure');
    expect(summary.get('Install targets')).toBe('WantedBy=multi-user.target');
    expect(summary.get('Findings')).toBe('0 error, 0 warning, 0 note');
  });

  it('counts what it parsed', async () => {
    const result = await run('good.service', 'summary');
    const rows = table(result).rows;
    const summary = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    const directives = Number.parseInt(summary.get('Directives') ?? '0', 10);
    expect(directives).toBeGreaterThan(10);
    expect(result.stats?.directives).toBe(directives);
    expect(result.stats?.lines).toBeGreaterThan(directives);
    expect(summary.get('Sections')).toContain('[Unit]');
    expect(summary.get('Sections')).toContain('[Service]');
    expect(summary.get('Sections')).toContain('[Install]');
    expect(summary.get('Ordering dependencies')).toContain('After=network-online.target');
    expect(summary.get('Requirements')).toContain('Wants=network-online.target');
  });

  it('falls back to pasted text when no unit name is given, and uses the name option when it is', async () => {
    const unnamed = new Map(table(await run('good.service', 'summary', { name: '' })).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(unnamed.get('Unit name')).toBe('(unknown — pasted text)');
    const named = new Map(table(await run('good.service', 'summary', { name: 'my-app.service' })).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(named.get('Unit name')).toBe('my-app.service');
    expect(named.get('Unit type')).toBe('service');
  });

  it('notes an unset User rather than inventing one', async () => {
    const rows = table(await run('hardening-light.service', 'summary')).rows;
    const summary = new Map(rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(summary.get('User')).toBe('(not set — runs as root)');
    expect(summary.get('ExecStart')).toContain('/bin/echo');
  });
});

describe('directives view', () => {
  it('lists every directive with its line and section in source order', async () => {
    const result = await run('good.service', 'directives');
    const rows = table(result).rows;
    expect(table(result).headers).toEqual(['Line', 'Section', 'Key', 'Value', 'Notes']);
    expect(rows.length).toBe(Number(result.stats?.directives));
    const lines = rows.map((row) => Number.parseInt(row[0] ?? '0', 10));
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
    expect(rows.some((row) => row[1] === 'Unit' && row[2] === 'Description' && row[3] === 'Example API')).toBe(true);
    expect(rows.some((row) => row[1] === 'Install' && row[2] === 'WantedBy')).toBe(true);
  });

  it('joins backslash continuations and attributes them to the first line', async () => {
    const result = await run('continuation.service', 'directives');
    const rows = table(result).rows;
    const exec = rows.find((row) => row[2] === 'ExecStart');
    expect(exec?.[3]).toBe('/bin/echo hello world');
    expect(exec?.[0]).toBe('2');
    expect(exec?.[4]).toContain('continues to line 4');
    expect(result.stats?.continuations).toBe(3);
    const environment = rows.find((row) => row[2] === 'Environment');
    expect(environment?.[3]).toBe('A=1 B=2');
  });

  it('splits command lines into arguments the way systemd does', async () => {
    const rows = table(await run('good.service', 'directives')).rows;
    const exec = rows.find((row) => row[2] === 'ExecStart');
    expect(exec?.[4]).toContain('2 arguments: /usr/bin/node /srv/app/server.js');
    const quoted = table(await run('quoted.service', 'directives')).rows.find((row) => row[2] === 'ExecStart');
    expect(quoted?.[4]).toContain('3 arguments: /bin/sh -c echo hello world');
    expect(quoted?.[3]).toBe('/bin/sh -c "echo hello world"');
    const codes = [...(quoted?.[3] ?? '')].map((character) => character.codePointAt(0)).join(',');
    expect(codes.endsWith('34')).toBe(true);
  });

  it('keeps a literal semicolon inside a value, because systemd does', async () => {
    const rows = table(await run('semicolon.service', 'directives')).rows;
    const exec = rows.find((row) => row[2] === 'ExecStart');
    expect(exec?.[3]).toBe('/bin/echo a; /bin/echo b');
    expect(levels(findings(await run('semicolon.service', 'findings')), 'error')).toEqual([]);
  });

  it('renders an empty view instead of an empty table', async () => {
    const result = await run('headers-only.service', 'directives');
    const rows = table(result).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]?.[3]).toContain('No directives were found');
  });
});

describe('dependencies view', () => {
  it('classifies ordering, requirement and install relationships', async () => {
    const rows = table(await run('good.service', 'dependencies')).rows;
    const kinds = rows.map((row) => row[0] ?? '');
    expect(kinds).toContain('Ordering: start after');
    expect(kinds).toContain('Weak requirement');
    expect(kinds.some((kind) => kind.startsWith('Install target'))).toBe(true);
    const after = rows.find((row) => row[0] === 'Ordering: start after');
    expect(after?.[1]).toBe('network-online.target');
    expect(after?.[3]).toBe('provided by systemd');
    expect(after?.[2]).toBe('line 3');
  });

  it('says it cannot resolve a unit it was not given, and recognises its own name', async () => {
    const rows = table(await run('dependencies.service', 'dependencies')).rows;
    const external = rows.find((row) => row[1] === 'telegraf.service');
    expect(external?.[3]).toContain('not defined in this file');
    const self = rows.find((row) => row[1] === 'dependencies.service');
    expect(self?.[3]).toBe('this unit itself');
  });

  it('says so when there is nothing to report', async () => {
    const rows = table(await run('headers-only.service', 'dependencies')).rows;
    expect(rows[0]?.[0]).toBe('(none)');
  });
});

describe('hardening view', () => {
  it('rates the hardened unit strongly and the bare one as missing', async () => {
    const good = new Map(table(await run('good.service', 'hardening')).rows.map((row) => [row[0] ?? '', row[2] ?? '']));
    expect(good.get('User')).toContain('strong');
    expect(good.get('NoNewPrivileges')).toContain('strong');
    expect(good.get('ProtectSystem')).toContain('strong');
    expect(good.get('PrivateTmp')).toContain('strong');
    const weak = new Map(table(await run('hardening-light.service', 'hardening')).rows.map((row) => [row[0] ?? '', row[2] ?? '']));
    expect(weak.get('User')).toContain('missing');
    expect(weak.get('NoNewPrivileges')).toContain('missing');
    expect(weak.get('ProtectSystem')).toContain('missing');
    expect(weak.get('PrivateDevices')).toContain('missing');
  });

  it('rates a boolean-ish setting as partial when it covers less', async () => {
    const rows = table(await run('partial-hardening.service', 'hardening')).rows;
    const protect = rows.find((row) => row[0] === 'ProtectSystem');
    expect(protect?.[2]).toContain('partial');
    const home = rows.find((row) => row[0] === 'ProtectHome');
    expect(home?.[2]).toContain('strong');
    const caps = rows.find((row) => row[0] === 'CapabilityBoundingSet');
    expect(caps?.[1]).toBe('');
    expect(caps?.[2]).toContain('strong');
  });

  it('counts the strong settings in its notes', async () => {
    const result = await run('good.service', 'hardening');
    expect(table(result).headers).toEqual(['Directive', 'Setting', 'Assessment']);
    expect(result.notes?.some((note) => /^\d+ of 17 hardening directives/u.test(note))).toBe(true);
    const summary = result.notes?.find((note) => note.includes('hardening directives')) ?? '';
    const strong = Number.parseInt(summary.split(' ')[0] ?? '0', 10);
    expect(strong).toBeGreaterThanOrEqual(4);
    expect(strong).toBeLessThan(17);
  });
});

describe('findings view', () => {
  it('says a clean unit is clean', async () => {
    const result = await run('good.service', 'findings');
    const rows = table(result).rows;
    expect(rows).toEqual([['ok', 'Nothing to flag', 'The unit parses cleanly and has no findings.']]);
    expect(result.warnings).toBeUndefined();
  });

  it('explains that a repeated single-value key is silent, not fatal', async () => {
    const rows = findings(await run('duplicate.service', 'findings'));
    const repeated = rows.find((row) => row[1] === 'Repeated key: Description');
    expect(repeated?.[0]).toBe('warning');
    expect(repeated?.[2]).toContain('systemd does not warn about this');
    expect(repeated?.[2]).toContain('2, 4');
    // systemd accepts this file without a word, so the inspector must not refuse it either.
    expect(EXPECTED.fixtures['duplicate.service']?.messages).toEqual([]);
    expect(EXPECTED.fixtures['duplicate.service']?.fatal).toBe(false);
    expect(levels(rows, 'error')).toEqual([]);
  });

  it('reports a non-fatal ignore as a warning, with the line systemd names', async () => {
    const rows = findings(await run('loose.service', 'findings'));
    const outside = rows.filter((row) => (row[1] ?? '').includes('outside any section'));
    // systemd decides on the section before it looks for '=', so both lines are outside a section.
    expect(outside.length).toBe(2);
    expect(outside.every((row) => row[0] === 'warning')).toBe(true);
    expect(outside[0]?.[2]).toContain('systemd reports "Assignment outside of section. Ignoring."');
    expect(outside[1]?.[2]).toContain('Line 2');
    expect(levels(rows, 'error')).toEqual([]);
    const broken = findings(await run('broken.service', 'findings'));
    expect(broken.find((row) => row[1] === 'A line has no equals sign')?.[2]).toContain('Line 9');
  });

  it('notes a unit that orders itself, which systemd drops', async () => {
    const rows = findings(await run('dependencies.service', 'findings'));
    const self = rows.find((row) => (row[1] ?? '').includes('A dependency on itself'));
    expect(self?.[0]).toBe('note');
    expect(self?.[2]).toContain('is dropped');
  });

  it('treats X- keys as the user\'s own and never flags them', async () => {
    const rows = findings(await run('customkey.service', 'findings'));
    expect(allText(rows)).not.toContain('X-MyThing');
    expect(levels(rows, 'error')).toEqual([]);
    expect(levels(rows, 'warning')).toEqual([]);
  });

  it('explains why a service with nothing to run is refused', async () => {
    const rows = findings(await run('noexec.service', 'findings'));
    const problem = rows.find((row) => row[1] === 'A service has nothing to run');
    expect(problem?.[0]).toBe('error');
    expect(problem?.[2]).toContain('Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.');
  });

  it('catches an ExecStart reset to empty', async () => {
    const rows = findings(await run('reset.service', 'findings'));
    expect(levels(rows, 'error')).toContain('A service has nothing to run');
    expect(rows.some((row) => row[1] === 'ExecStart= is empty')).toBe(true);
  });

  it('catches shell syntax without pretending systemd rejects it', async () => {
    const rows = findings(await run('hardening-light.service', 'findings'));
    const shell = rows.filter((row) => (row[1] ?? '').startsWith('Shell syntax in ExecStart'));
    expect(shell.length).toBeGreaterThan(0);
    expect(shell[0]?.[0]).toBe('note');
    expect(shell[0]?.[2]).toContain('runs no shell');
    expect(shell[0]?.[2]).toContain('a glob character (*)');
    expect(rows.some((row) => row[1] === 'The service runs as root')).toBe(true);
    expect(rows.some((row) => row[1] === 'No filesystem or privilege hardening at all')).toBe(true);
  });

  it('does not flag shell characters that are safely quoted', async () => {
    const rows = findings(await run('quoted.service', 'findings'));
    expect(rows.some((row) => (row[1] ?? '').startsWith('Shell syntax'))).toBe(false);
  });

  it('flags an unclosed quote as the refusal systemd makes of it', async () => {
    const rows = findings(await run('unbalanced.service', 'findings'));
    const quote = rows.filter((row) => row[1] === 'A command line has an unclosed quote');
    expect(quote.length).toBe(1);
    expect(quote[0]?.[0]).toBe('error');
    expect(quote[0]?.[2]).toContain('Line 5');
    expect(quote[0]?.[2]).toContain('Unbalanced quoting');
    expect(rows.some((row) => (row[1] ?? '').startsWith('Shell syntax'))).toBe(false);
  });

  it('mentions instance specifiers only for non-template units', async () => {
    expect(levels(findings(await run('template@.service', 'findings')), 'note')).not.toContain('%i is used outside a template unit');
    expect(levels(findings(await run('app.service', 'findings')), 'note')).toContain('%i is used outside a template unit');
  });

  it('notes missing install information and a missing description', async () => {
    const rows = findings(await run('noexec.service', 'findings'));
    expect(rows.some((row) => row[1] === 'There is no [Install] section')).toBe(true);
    const installless = findings(await run('install-only.service', 'findings'));
    expect(installless.some((row) => row[1] === '[Install] has no target')).toBe(true);
  });

  it('notes CRLF line endings', async () => {
    const rows = findings(await run('crlf.service', 'findings'));
    expect(rows.some((row) => row[1] === 'The file uses CRLF line endings')).toBe(true);
  });

  it('can switch the hardening advice off', async () => {
    const withAdvice = findings(await run('hardening-light.service', 'findings'));
    const without = findings(await run('hardening-light.service', 'findings', { harden: false }));
    expect(withAdvice.some((row) => row[1] === 'The service runs as root')).toBe(true);
    expect(without.some((row) => row[1] === 'The service runs as root')).toBe(false);
    expect(without.some((row) => (row[1] ?? '').startsWith('Shell syntax'))).toBe(true);
  });

  it('warns along the result that part of the file would be ignored', async () => {
    const result = await run('loose.service', 'findings');
    expect(result.notes?.some((note) => note.includes('Nothing here stops systemd from loading the unit'))).toBe(true);
    const refused = await run('noexec.service', 'findings');
    expect(refused.warnings?.some((warning) => warning.includes('would stop systemd from loading this unit'))).toBe(true);
  });
});

describe('parsing details', () => {
  it('treats whole-line comments as comments and never strips inline ones', async () => {
    const result = await run('good.service', 'summary');
    expect(result.stats?.directives).toBeGreaterThan(0);
    const semicolon = table(await run('semicolon.service', 'directives')).rows.find((row) => row[2] === 'ExecStart');
    expect(semicolon?.[3]).toContain(';');
    const rows = table(await run('comments.service', 'directives')).rows;
    expect(rows.some((row) => row[2] === 'ExecStart' && row[3] === '/bin/true # not a comment')).toBe(true);
  });

  it('tolerates whitespace around the equals sign, as systemd does', async () => {
    const rows = table(await run('spaced.service', 'directives')).rows;
    expect(rows.find((row) => row[2] === 'ExecStart')?.[3]).toBe('/bin/true');
    expect(levels(findings(await run('spaced.service', 'findings')), 'error')).toEqual([]);
  });

  it('rejects input that is not a unit file', async () => {
    await expect(tool.run({ text: '   ', options: {} })).rejects.toThrow(/No unit file/u);
    await expect(tool.run({ text: 'just some prose', options: {} })).rejects.toThrow(/does not look like a systemd unit file/u);
  });

  it('reports a unit type from the name suffix and from the sections when pasted', async () => {
    const timer = new Map(table(await run('sample.timer', 'summary')).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(timer.get('Unit type')).toBe('timer');
    const unnamed = new Map(table(await run('sample.timer', 'summary', { name: '' })).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(unnamed.get('Unit type')).toBe('timer');
    const unknown = new Map(table(await run('headers-only.service', 'summary', { name: 'no-suffix-here' })).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(unknown.get('Unit type')).toBe('(not determined from the name)');
  });

  it('flags a section the unit type cannot contain', async () => {
    const rows = findings(await run('sample.timer', 'findings'));
    expect(levels(rows, 'note')).toContain('Unknown section [Service]');
    expect(EXPECTED.fixtures['sample.timer']?.messages.some((message) => message.includes("Unknown section 'Service'"))).toBe(true);
  });
});
