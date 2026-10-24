import { describe, expect, it } from 'vitest';
import tool from './iptables-ruleset-auditor.tool';
import { meta } from './iptables-ruleset-auditor.meta';

/**
 * Grammar verdicts produced by the iptables toolchain itself, one entry per fixture rule:
 *   iptables-translate <rule>  ->  exit 0 (ok) or exit 2 (reject) plus the message on stderr.
 * They are baked in as literals so the test never shells out.
 */
const ORACLE: { rule: string; verdict: 'ok' | 'reject'; message: string; divergent: boolean }[] = [
  {
    rule: '-A INPUT -p tcp --dport 22 -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT --dport 22 -j ACCEPT',
    verdict: 'reject',
    message: 'unknown option "--dport"',
    divergent: false,
  },
  {
    rule: '-A INPUT -p all --dport 22 -j ACCEPT',
    verdict: 'reject',
    message: 'unknown option "--dport"',
    divergent: false,
  },
  {
    rule: '-A INPUT --dport 22 -p tcp -j ACCEPT',
    verdict: 'reject',
    message: 'unknown option "--dport"',
    divergent: false,
  },
  {
    rule: '-A OUTPUT -i eth0 -j ACCEPT',
    verdict: 'reject',
    message: "Can't use --in-interface with OUTPUT",
    divergent: false,
  },
  {
    rule: '-A INPUT -o eth0 -j ACCEPT',
    verdict: 'reject',
    message: "Can't use --out-interface with INPUT",
    divergent: false,
  },
  {
    rule: '-A INPUT -j ACCEPT -j DROP',
    verdict: 'reject',
    message: 'multiple --jump options not allowed',
    divergent: false,
  },
  {
    rule: '-A INPUT -j',
    verdict: 'reject',
    message: 'option "-j" requires an argument',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport 99999 -j ACCEPT',
    verdict: 'reject',
    message: "invalid port/service `99999' specified",
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp -m multiport --dports 80,443, -j ACCEPT',
    verdict: 'reject',
    message: "invalid port/service `' specified",
    divergent: false,
  },
  {
    rule: '-A INPUT -m conntrack --ctstate BOGUS -j ACCEPT',
    verdict: 'reject',
    message: 'Bad ctstate "BOGUS"',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport 1024:2048 -j DROP',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --sport 1024: -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport 22',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport 22 -j ACCEPT --wait',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -j NOSUCHCHAIN',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p 6 --dport 22 -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport ssh -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
  {
    rule: '-A INPUT -p tcp --dport notaport -j ACCEPT',
    verdict: 'reject',
    message: "invalid port/service `notaport' specified",
    divergent: true,
  },
  {
    rule: '-A INPUT -p tcp --dport 0 -j ACCEPT',
    verdict: 'ok',
    message: '',
    divergent: false,
  },
];

const FIX = {
  example:
    '*filter\n:INPUT DROP [0:0]\n:FORWARD DROP [0:0]\n:OUTPUT ACCEPT [0:0]\n:LOG_DROP - [0:0]\n' +
    '-A INPUT -i lo -j ACCEPT\n-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\n' +
    '-A INPUT -p tcp --dport 22 -j ACCEPT\n-A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT\n' +
    '-A INPUT -p udp --dport 53 -j ACCEPT\n-A INPUT -j LOG_DROP\n' +
    '-A LOG_DROP -m limit --limit 5/min -j LOG --log-prefix "iptables denied: "\n-A LOG_DROP -j DROP\nCOMMIT\n' +
    '*nat\n:PREROUTING ACCEPT [0:0]\n:INPUT ACCEPT [0:0]\n:OUTPUT ACCEPT [0:0]\n:POSTROUTING ACCEPT [0:0]\nCOMMIT\n',
  clean:
    '*filter\n:INPUT DROP [0:0]\n:FORWARD DROP [0:0]\n:OUTPUT ACCEPT [0:0]\n-A INPUT -i lo -j ACCEPT\n' +
    '-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\n-A INPUT -p tcp --dport 22 -j ACCEPT\n' +
    '-A INPUT -j DROP\nCOMMIT\n',
  noCommit: '*filter\n:INPUT DROP [0:0]\n-A INPUT -j ACCEPT\n',
  ruleBeforeTable: '-A INPUT -j ACCEPT\n*filter\n:INPUT DROP [0:0]\nCOMMIT\n',
  shadowed: '-A INPUT -j DROP\n-A INPUT -p tcp --dport 22 -j ACCEPT\n',
  duplicate: '-A INPUT -p tcp --dport 80 -j ACCEPT\n-A INPUT -p tcp --dport 80 -j ACCEPT\n',
  missingChain: '-A INPUT -j CUSTOM\n',
  declaredChain: '-N CUSTOM\n-A CUSTOM -j ACCEPT\n',
  logNoLimit: '-A INPUT -j LOG --log-prefix "denied "\n',
  deprecated: '-A INPUT -m state --state NEW -p tcp --dport 22 -j ACCEPT\n',
  failOpen: '-P INPUT ACCEPT\n-A INPUT -s 10.0.0.0/8 -j DROP\n',
  noEstablished:
    '*filter\n:INPUT DROP [0:0]\n:FORWARD DROP [0:0]\n:OUTPUT ACCEPT [0:0]\n' +
    '-A INPUT -p tcp --dport 22 -j ACCEPT\nCOMMIT\n',
  restrictedSensitive: '-A INPUT -s 192.0.2.0/24 -p tcp --dport 22 -j ACCEPT\n',
  insert: '-A INPUT -p tcp --dport 80 -j ACCEPT\n-I INPUT 1 -j DROP\n',
  bogusPolicy: '*filter\n:INPUT DROP [0:0]\n:FORWARD BOGUS [0:0]\nCOMMIT\n',
  unreferencedChain: '-N MYCHAIN\n-A MYCHAIN -j ACCEPT\n',
  openApp: '-A INPUT -p tcp --dport 8080 -j ACCEPT\n',
  manyPorts:
    '-A INPUT -p tcp --dport 22 -j ACCEPT\n-A INPUT -p tcp --dport 23 -j ACCEPT\n-A INPUT -p tcp --dport 80 -j ACCEPT\n' +
    '-A INPUT -p tcp --dport 443 -j ACCEPT\n-A INPUT -p tcp --dport 3306 -j ACCEPT\n',
  nft: 'table ip filter {\n\tchain input {\n\t\ttype filter hook input priority 0; policy drop;\n\t}\n}\n',
};

const GRAMMAR = ORACLE.map((entry) => entry.rule).join('\n') + '\n';

interface Result {
  outputs: string[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}

const table = (result: Result): { headers: string[]; rows: string[][] } =>
  JSON.parse(result.report?.output ?? '{"headers":[],"rows":[]}') as {
    headers: string[];
    rows: string[][];
  };

const run = (
  text: string,
  format: string,
  options: Record<string, unknown> = {},
): Promise<Result> =>
  tool.run({ files: [], text, options: { format, ...options } }) as unknown as Promise<Result>;

const summaryOf = async (
  text: string,
  options: Record<string, unknown> = {},
): Promise<Map<string, string>> => {
  const result = await run(text, 'summary', options);
  return new Map(table(result).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
};

const columns = (result: Result, index: number): string[] =>
  table(result).rows.map((row) => row[index] ?? '');
const details = (result: Result): string => JSON.stringify(table(result).rows);

describe('iptables-ruleset-auditor metadata', () => {
  it('describes a security tool that reads text on device', () => {
    expect(meta.id).toBe('iptables-ruleset-auditor');
    expect(meta.category).toBe('security');
    expect(meta.input).toBe('file');
    expect(meta.acceptsText).toBe(true);
    expect(meta.privacy.processing).toBe('on-device');
    expect(meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect((meta.options ?? []).map((option) => option.key)).toEqual([
      'format',
      'sensitive',
      'top',
    ]);
  });

  it('explains where the verdicts come from without stray escape sequences', () => {
    const answer =
      (meta.faq ?? []).find((entry) => entry.q.includes('Where do the error messages come from'))
        ?.a ?? '';
    expect(answer).toContain('unknown option "--dport" when a port is given without -p tcp');
    expect(answer).toContain("Can't use --out-interface with INPUT");
    expect(answer).not.toContain('\\');
  });
});

describe('grammar against the iptables toolchain (independent oracle)', () => {
  it('agrees with iptables-translate about which rules iptables refuses', async () => {
    const result = await run(GRAMMAR, 'rules');
    expect(table(result).rows.length).toBe(ORACLE.length);
    for (const [index, entry] of ORACLE.entries()) {
      const invalid = table(result).rows[index]?.[5] === 'invalid';
      if (entry.divergent) {
        // /etc/services does not exist in a browser, so a service name is kept rather than resolved.
        expect([index, entry.verdict, invalid]).toEqual([index, 'reject', false]);
      } else {
        expect([index, entry.rule, invalid]).toEqual([
          index,
          entry.rule,
          entry.verdict === 'reject',
        ]);
      }
    }
  });

  it('quotes the same message iptables prints, for every rule iptables rejects', async () => {
    const result = await run(GRAMMAR, 'findings');
    const rows = table(result).rows;
    const rejects = ORACLE.filter((entry) => entry.verdict === 'reject' && !entry.divergent);
    expect(rejects.length).toBe(10);
    for (const entry of rejects) {
      const found = rows.some(
        (row) => (row[2] ?? '').includes(entry.message) && (row[0] ?? '') === 'error',
      );
      expect([entry.rule, found]).toEqual([entry.rule, true]);
    }
  });

  it('does not mark rules unreachable just because an invalid rule sits above them', async () => {
    const result = await run(GRAMMAR, 'rules');
    expect(columns(result, 5).some((note) => note.includes('unreachable'))).toBe(false);
    const stats = (await run(GRAMMAR, 'summary')).stats;
    // 10 grammar errors iptables-translate also reports, plus the unknown jump target.
    expect(stats?.errors).toBe(11);
    // Two real warnings among the valid rules: the DROP under the assumed ACCEPT policy and -m state.
    expect(stats?.warnings).toBe(2);
  });
});

describe('ruleset summary', () => {
  it('describes a typical server ruleset', async () => {
    const summary = await summaryOf(FIX.example);
    expect(summary.get('Source')).toBe('pasted text');
    expect(summary.get('Format')).toBe('iptables-save');
    expect(summary.get('Tables')).toBe('filter, nat');
    expect(summary.get('Chains')).toBe('8 (1 user)');
    expect(summary.get('Rules')).toBe('8');
    expect(summary.get('Policies')).toBe('FORWARD=DROP, INPUT=DROP (5 chain(s) accept by default)');
    expect(summary.get('Verdicts')).toBe('5 accept, 1 drop/reject, 1 jump');
    expect(summary.get('Exposed ports')).toBe('4: tcp/22, tcp/80, tcp/443, udp/53');
    expect(summary.get('Sensitive ports open')).toBe('22');
    expect(summary.get('Established-connection rule')).toBe('present');
    expect(summary.get('Interface-limited rules')).toBe('1');
    expect(summary.get('Source-limited rules')).toBe('0');
    expect(summary.get('Findings')).toBe('0 error, 0 warning, 2 note');
  });

  it('reports counters and warns about the open sensitive port', async () => {
    const result = await run(FIX.example, 'summary');
    expect(result.stats).toMatchObject({
      tables: 2,
      chains: 8,
      rules: 8,
      exposedPorts: 4,
      sensitiveOpen: 1,
      errors: 0,
      warnings: 0,
      notes: 2,
    });
    expect(result.warnings).toEqual(['1 sensitive port(s) are accepted from anywhere.']);
  });

  it('says a clean ruleset is clean', async () => {
    const summary = await summaryOf(FIX.clean);
    expect(summary.get('Findings')).toBe('0 error, 0 warning, 1 note');
    expect(summary.get('Sensitive ports open')).toBe('22');
    const result = await run(FIX.clean, 'findings');
    expect(table(result).rows.length).toBe(1);
    expect(table(result).rows[0]?.[0]).toBe('note');
  });

  it('reads a plain command list and assumes the filter table', async () => {
    const commandList =
      '-P INPUT DROP\n' +
      '-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\n' +
      '-A INPUT -p tcp --dport 443 -j ACCEPT\n';
    const summary = await summaryOf(commandList);
    expect(summary.get('Format')).toBe('iptables command list (table filter assumed)');
    expect(summary.get('Policies')).toBe('INPUT=DROP (2 chain(s) accept by default)');
    expect(summary.get('Rules')).toBe('2');
  });
});

describe('chains view', () => {
  it('lists every chain with its policy and verdict mix', async () => {
    const result = await run(FIX.example, 'chains');
    const rows = table(result).rows;
    expect(rows[0]).toEqual(['FORWARD', 'filter', 'DROP', '0', 'A:0 D:0 J:0', 'no rules']);
    expect(rows[1]).toEqual(['INPUT', 'filter', 'DROP', '6', 'A:5 D:0 J:1', '-']);
    expect(rows[2]).toEqual(['LOG_DROP', 'filter', 'return', '2', 'A:0 D:1 J:0', 'user chain']);
    expect(rows[3]).toEqual(['OUTPUT', 'filter', 'ACCEPT', '0', 'A:0 D:0 J:0', 'no rules']);
    expect(table(result).rows.length).toBe(8);
    expect(columns(result, 0).slice(4)).toEqual(['INPUT', 'OUTPUT', 'POSTROUTING', 'PREROUTING']);
    expect(columns(result, 1).slice(4)).toEqual(['nat', 'nat', 'nat', 'nat']);
  });

  it('does not accuse an empty DROP chain of dropping its own replies', async () => {
    const rows = table(await run(FIX.noEstablished, 'chains')).rows;
    expect(rows.find((row) => row[0] === 'FORWARD')?.[5]).toBe('no rules');
    expect(rows.find((row) => row[0] === 'INPUT')?.[5]).toContain('drops replies');
  });
});

describe('rules view', () => {
  it('numbers rules, keeps their line numbers and normalises the match text', async () => {
    const result = await run(FIX.example, 'rules');
    const rows = table(result).rows;
    expect(rows[0]).toEqual(['1', '6', 'INPUT', '-i lo', '-j ACCEPT', '-']);
    expect(rows[2]).toEqual(['3', '8', 'INPUT', '-p tcp --dport 22', '-j ACCEPT', 'no --syn']);
    expect(rows[5]).toEqual(['6', '11', 'INPUT', '(no match conditions)', '-j LOG_DROP', '-']);
    expect(rows[7]).toEqual(['8', '13', 'LOG_DROP', '(no match conditions)', '-j DROP', '-']);
    expect(columns(result, 2)).toEqual([
      'INPUT',
      'INPUT',
      'INPUT',
      'INPUT',
      'INPUT',
      'INPUT',
      'LOG_DROP',
      'LOG_DROP',
    ]);
  });

  it('marks an inserted rule and the rule it makes unreachable', async () => {
    const rows = table(await run(FIX.insert, 'rules')).rows;
    expect(rows[0]?.[5]).toContain('unreachable, rule 2 matches everything');
    expect(rows[1]?.[5]).toBe('inserted at position 1');
    expect((await summaryOf(FIX.insert)).get('Inserted rules')).toBe('1');
  });
});

describe('ports view', () => {
  it('lists accepted ports with sensitive ones first', async () => {
    const result = await run(FIX.example, 'ports');
    const rows = table(result).rows;
    expect(rows[0]).toEqual([
      '1',
      '22',
      'tcp',
      'any',
      'INPUT',
      '#3',
      'sensitive, open to the world',
    ]);
    expect(rows[1]).toEqual(['2', '53', 'udp', 'any', 'INPUT', '#5', '-']);
    expect(rows[2]?.[1]).toBe('80');
    expect(rows[2]?.[5]).toBe('#4');
    expect(rows[3]?.[1]).toBe('443');
    expect(rows[3]?.[5]).toBe('#4');
  });

  it('marks a port that an earlier unconditional DROP shadows, and stops calling it open', async () => {
    const rows = table(await run(FIX.shadowed, 'ports')).rows;
    expect(rows[0]?.[6]).toBe('shadowed by #1');
    const summary = await summaryOf(FIX.shadowed);
    expect(summary.get('Sensitive ports open')).toBe('none from any source');
    expect((await run(FIX.shadowed, 'summary')).warnings).toEqual([]);
  });

  it('distinguishes a sensitive port that is limited to a source', async () => {
    const rows = table(await run(FIX.restrictedSensitive, 'ports')).rows;
    expect(rows[0]?.[3]).toBe('192.0.2.0/24');
    expect(rows[0]?.[6]).toBe('sensitive, but restricted');
    expect((await summaryOf(FIX.restrictedSensitive)).get('Sensitive ports open')).toBe(
      'none from any source',
    );
  });

  it('honours the sensitive list option and the row limit', async () => {
    expect((await summaryOf(FIX.openApp)).get('Sensitive ports open')).toBe('none from any source');
    expect((await summaryOf(FIX.openApp, { sensitive: '8080' })).get('Sensitive ports open')).toBe(
      '8080',
    );
    const result = await run(FIX.manyPorts, 'ports', { top: 3 });
    expect(table(result).rows.length).toBe(3);
    expect(columns(result, 1)).toEqual(['22', '23', '3306']);
    expect(result.notes?.some((note) => note.includes('Showing 3 of 5'))).toBe(true);
  });
});

describe('findings', () => {
  it('flags the risky combination of a DROP rule under an ACCEPT policy', async () => {
    expect(details(await run(FIX.failOpen, 'findings'))).toContain(
      'A drop rule sits under an ACCEPT policy',
    );
  });

  it('flags a chain that drops / replies it cannot return', async () => {
    const result = await run(FIX.noEstablished, 'findings');
    expect(result.stats?.warnings).toBe(1);
    const rows = table(result).rows;
    const found = rows.filter(
      (row) => (row[1] ?? '') === 'Nothing accepts established connections',
    );
    expect(found.length).toBe(1);
    expect(found[0]?.[2]).toContain('INPUT');
  });

  it('flags an unrate-limited log rule', async () => {
    expect(details(await run(FIX.logNoLimit, 'findings'))).toContain(
      'A log rule has no rate limit',
    );
  });

  it('flags the deprecated state module', async () => {
    expect(details(await run(FIX.deprecated, 'findings'))).toContain(
      'A deprecated match module is used',
    );
  });

  it('flags a duplicate rule once, with both line numbers', async () => {
    const text = details(await run(FIX.duplicate, 'findings'));
    expect(text).toContain('A duplicate rule');
    expect(text).toContain('Lines 1 and 2 are identical');
  });

  it('flags a jump to a chain nothing creates', async () => {
    const text = details(await run(FIX.missingChain, 'findings'));
    expect(text).toContain('A rule jumps to a chain that does not exist');
    expect(text).toContain('No chain/target/match by that name');
  });

  it('does not flag a user chain that is declared and used', async () => {
    const text = details(await run(FIX.declaredChain, 'findings'));
    expect(text).not.toContain('jumps to a chain that does not exist');
    expect(text).toContain('A user chain is never referenced');
  });

  it('notes a user chain nothing jumps to', async () => {
    expect(details(await run(FIX.unreferencedChain, 'findings'))).toContain(
      'MYCHAIN is created but no rule jumps to it',
    );
  });

  it('flags a policy name the kernel cannot accept', async () => {
    const text = details(await run(FIX.bogusPolicy, 'findings'));
    expect(text).toContain('A policy name no kernel accepts');
    expect(text).toContain('BOGUS');
  });

  it('reports a table with no COMMIT the way iptables-restore does', async () => {
    const result = await run(FIX.noCommit, 'findings');
    expect(result.stats?.errors).toBe(1);
    const text = details(result);
    expect(text).toContain('A table is not closed');
    expect(text).toContain('COMMIT expected');
  });

  it('reports a rule that appears before the first table', async () => {
    const text = details(await run(FIX.ruleBeforeTable, 'findings'));
    expect(text).toContain('A rule appears before the first table');
    expect(text).toContain('line 1 failed');
  });

  it('says the ruleset would be refused while an error is present', async () => {
    expect(details(await run(FIX.missingChain, 'findings'))).toContain(
      'would be refused before it does anything',
    );
  });
});

describe('guards', () => {
  it('refuses an nftables ruleset with an explanation', async () => {
    await expect(tool.run({ files: [], text: FIX.nft, options: {} })).rejects.toThrow(/nftables/u);
  });

  it('refuses input with no rules at all', async () => {
    await expect(tool.run({ files: [], text: 'just some prose', options: {} })).rejects.toThrow(
      /No iptables rules/u,
    );
    await expect(tool.run({ files: [], text: '   \n\n', options: {} })).rejects.toThrow(
      /No ruleset/u,
    );
  });

  it('refuses an empty file', async () => {
    await expect(tool.run({ files: [new File([''], 'rules.v4')], options: {} })).rejects.toThrow(
      /empty/u,
    );
  });

  it('accepts an uploaded file and names it', async () => {
    const result = (await tool.run({
      files: [new File([FIX.clean], 'rules.v4')],
      options: { format: 'summary' },
    })) as unknown as Result;
    const summary = new Map(table(result).rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(summary.get('Source')).toBe('rules.v4');
  });
});
