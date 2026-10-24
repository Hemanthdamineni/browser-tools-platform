import { describe, expect, it } from 'vitest';
import tool from './ssh-config-auditor.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const view = async (
  text: string,
  format: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Table> => {
  const result = await run(text, { ...options, format });
  return JSON.parse(result.report?.output ?? '{}') as Table;
};

const problems = (table: Table): string[] => table.rows.map((row) => row[2] ?? '');
const levels = (table: Table): string[] => table.rows.map((row) => row[0] ?? '');

const CONFIG = [
  '# defaults',
  'Host *',
  '\tUser deploy',
  '\tIdentityFile ~/.ssh/id_ed25519',
  '\tForwardAgent yes',
  '',
  'Host prod',
  '\tHostName prod.example.com:2222',
  '\tUser root',
  '\tIdentityFile ~/.ssh/prod_rsa',
  '\tStrictHostKeyChecking no',
  '\tCiphers +3des-cbc',
  '',
  'Host db',
  '\tHostName db.internal',
  '\tPort 2200',
  '\tProxyCommand nc %h %p',
].join('\n');

describe('ssh-config-auditor', () => {
  it('flags the shadowing Host * block', async () => {
    const result = await run(CONFIG);
    const found = problems(await view(CONFIG, 'audit'));
    expect(found).toContain('Host * shadows later blocks');
    const row = (await view(CONFIG, 'audit')).rows.find((entry) => entry[2] === 'Host * shadows later blocks');
    expect(row?.[3]).toMatch(/identityfile, user/);
    expect(result.stats?.warnings).toBe(6);
    expect(result.stats?.errors).toBe(0);
  });

  it('flags disabled host key checking, agent forwarding and netcat proxies', async () => {
    const found = problems(await view(CONFIG, 'audit'));
    expect(found).toContain('Host key checking is disabled');
    expect(found).toContain('Agent forwarding is on for every host');
    expect(found).toContain('ProxyCommand uses plain netcat');
  });

  it('flags a weak algorithm that was appended to the defaults', async () => {
    const table = await view(CONFIG, 'audit');
    const row = table.rows.find((entry) => entry[2] === 'Weak algorithm in ciphers: 3des-cbc');
    expect(row?.[0]).toBe('warning');
    expect(row?.[3]).toMatch(/leading \+ appends/i);
  });

  it('flags a hostname that carries a port', async () => {
    const found = problems(await view(CONFIG, 'audit'));
    expect(found).toContain('HostName contains a port');
  });

  it('lists the blocks it parsed', async () => {
    const table = await view(CONFIG, 'hosts');
    expect(table.headers).toEqual(['#', 'Type', 'Pattern or condition', 'Line', 'Directives']);
    expect(table.rows).toEqual([
      ['1', 'Host', '*', '2', '3'],
      ['2', 'Host', 'prod', '7', '5'],
      ['3', 'Host', 'db', '14', '3'],
    ]);
  });

  it('resolves a host with first-match-wins semantics', async () => {
    const table = await view(CONFIG, 'resolve', { host: 'prod' });
    expect(table.headers).toEqual(['Setting', 'Value', 'From']);
    expect(table.rows).toEqual([
      ['user', 'deploy', 'Host * line 3'],
      ['identityfile', '~/.ssh/id_ed25519', 'Host * line 4'],
      ['forwardagent', 'yes', 'Host * line 5'],
      ['hostname', 'prod.example.com:2222', 'Host prod line 8'],
      ['stricthostkeychecking', 'no', 'Host prod line 11'],
      ['ciphers', '+3des-cbc', 'Host prod line 12'],
    ]);
  });

  it('says how many values were ignored', async () => {
    const result = await run(CONFIG, { format: 'resolve', host: 'prod' });
    expect(result.notes?.join(' ')).toMatch(/2 overridden value\(s\) were ignored/i);
    expect(result.stats?.settings).toBe(6);
  });

  it('resolves a different host to different settings', async () => {
    const table = await view(CONFIG, 'resolve', { host: 'db' });
    const map = new Map(table.rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(map.get('port')).toBe('2200');
    expect(map.get('hostname')).toBe('db.internal');
    expect(map.get('user')).toBe('deploy');
    expect(map.get('stricthostkeychecking')).toBeUndefined();
  });

  it('honours negated host patterns', async () => {
    const config = ['Host * !skip.example', '\tUser general', 'Host skip.example', '\tUser special'].join('\n');
    const skipped = await view(config, 'resolve', { host: 'skip.example' });
    expect(skipped.rows).toEqual([['user', 'special', 'Host skip.example line 4']]);
    const other = await view(config, 'resolve', { host: 'other.example' });
    expect(other.rows).toEqual([['user', 'general', 'Host * !skip.example line 2']]);
  });

  it('evaluates Match host blocks and skips the ones it cannot judge', async () => {
    const config = [
      'Host *.corp',
      '\tUser corpuser',
      'Match host *.corp',
      '\tForwardAgent yes',
      'Match user alice',
      '\tPort 2222',
    ].join('\n');
    const result = await run(config, { format: 'resolve', host: 'web.corp' });
    const table = JSON.parse(result.report?.output ?? '{}') as Table;
    expect(table.rows).toEqual([
      ['user', 'corpuser', 'Host *.corp line 2'],
      ['forwardagent', 'yes', 'Match host *.corp line 4'],
    ]);
    expect(result.notes?.join(' ')).toMatch(/1 Match block\(s\) could not be evaluated/i);
    expect(problems(await view(config, 'audit'))).toContain('Match block depends on the live session');
  });

  it('treats Match all as matching', async () => {
    const config = ['Match all', '\tServerAliveInterval 30'].join('\n');
    const table = await view(config, 'resolve', { host: 'anything' });
    expect(table.rows).toEqual([['serveraliveinterval', '30', 'Match all line 2']]);
  });

  it('reports configuration errors', async () => {
    const config = ['Host', '\tUser', '\tPort abc', 'Host ok', '\tPort 99999'].join('\n');
    const result = await run(config);
    const found = problems(await view(config, 'audit'));
    expect(found).toContain('Host directive without a pattern');
    expect(found).toContain('Directive has no value');
    expect(found).toContain('Port is not a number');
    expect(found).toContain('Port is outside 1-65535');
    expect(result.stats?.errors).toBe(4);
    expect(result.warnings?.join(' ')).toMatch(/4 configuration error/i);
  });

  it('flags deprecated and unrecognised keywords', async () => {
    const config = ['RSAAuthentication yes', 'Foobar yes'].join('\n');
    const found = problems(await view(config, 'audit'));
    expect(found).toContain('Deprecated keyword: rsaauthentication');
    expect(found).toContain('Unrecognised keyword: foobar');
  });

  it('flags a discarded known hosts file', async () => {
    const config = ['Host risky', '\tUserKnownHostsFile /dev/null'].join('\n');
    expect(problems(await view(config, 'audit'))).toContain('Known hosts file is discarded');
  });

  it('accepts strong algorithms without complaint', async () => {
    const config = [
      'Host good',
      '\tCiphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com',
      '\tMACs hmac-sha2-256-etm@openssh.com',
      '\tKexAlgorithms curve25519-sha256',
      '\tHostKeyAlgorithms ssh-ed25519',
    ].join('\n');
    const result = await run(config);
    expect(result.stats?.warnings).toBe(0);
    expect((await view(config, 'audit')).rows[0]?.[0]).toBe('ok');
  });

  it('flags each weak algorithm family', async () => {
    const config = [
      'Host weak',
      '\tMACs hmac-sha1',
      '\tKexAlgorithms +diffie-hellman-group1-sha1',
      '\tHostKeyAlgorithms ssh-rsa',
      '\tPubkeyAcceptedAlgorithms -ssh-rsa',
    ].join('\n');
    const found = problems(await view(config, 'audit'));
    expect(found).toContain('Weak algorithm in macs: hmac-sha1');
    expect(found).toContain('Weak algorithm in kexalgorithms: diffie-hellman-group1-sha1');
    expect(found).toContain('Weak algorithm in hostkeyalgorithms: ssh-rsa');
    expect(found).toContain('Weak algorithm in pubkeyacceptedalgorithms: ssh-rsa');
  });

  it('notes a keyword set twice in one block', async () => {
    const config = ['Host twice', '\tUser first', '\tUser second'].join('\n');
    const table = await view(config, 'audit');
    const row = table.rows.find((entry) => entry[2] === 'Keyword set twice in the same block');
    expect(row?.[0]).toBe('note');
    expect(row?.[3]).toMatch(/line 2 wins/i);
  });

  it('notes duplicate Host patterns and bare identity files', async () => {
    const config = ['Host same', '\tIdentityFile id_rsa', 'Host same', '\tUser bob'].join('\n');
    const found = problems(await view(config, 'audit'));
    expect(found).toContain('Duplicate Host pattern');
    expect(found).toContain('IdentityFile is a bare filename');
  });

  it('strips comments and quotes values', async () => {
    const config = [
      '# a comment',
      'Host quoted',
      '\tIdentityFile "~/my key"   # trailing comment',
      '\tUser bob # inline',
    ].join('\n');
    const table = await view(config, 'resolve', { host: 'quoted' });
    expect(table.rows).toEqual([
      ['identityfile', '~/my key', 'Host quoted line 3'],
      ['user', 'bob', 'Host quoted line 4'],
    ]);
  });

  it('notes global directives and includes without following them', async () => {
    const config = ['User root', 'Include ~/.ssh/other.conf', 'Host prod', '\tHostName p.example.com'].join('\n');
    const result = await run(config);
    expect(result.notes?.join(' ')).toMatch(/before the first Host apply to every host/i);
    expect(result.notes?.join(' ')).toMatch(/Include line\(s\) were reported but not followed/i);
    const table = await view(config, 'hosts');
    expect(table.rows[0]?.[1]).toBe('Global');
    expect(table.rows[0]?.[2]).toBe('(applies to all hosts)');
  });

  it('lets a global directive win over a later Host block', async () => {
    const config = ['User root', 'Host prod', '\tUser deploy'].join('\n');
    const table = await view(config, 'resolve', { host: 'prod' });
    expect(table.rows).toEqual([['user', 'root', 'global line 1']]);
  });

  it('can skip the security audit', async () => {
    const result = await run(CONFIG, { checkPolicy: false });
    expect(result.stats?.errors).toBe(0);
    expect(result.stats?.warnings).toBe(1);
    const found = problems(await view(CONFIG, 'audit', { checkPolicy: false }));
    expect(found).not.toContain('Host key checking is disabled');
    expect(found).not.toContain('Host * shadows later blocks');
    expect(found).toContain('HostName contains a port');
  });

  it('summarizes the file', async () => {
    const table = await view(CONFIG, 'summary');
    const map = new Map(table.rows.map((row) => [row[0] ?? '', row[1] ?? '']));
    expect(map.get('Host blocks')).toBe('3');
    expect(map.get('Match blocks')).toBe('0');
    expect(map.get('Host aliases')).toBe('prod, db');
    expect(map.get('Include lines')).toBe('none');
    expect(map.get('Errors')).toBe('0');
  });

  it('reports findings with a level, location and reason', async () => {
    const table = await view(CONFIG, 'audit');
    expect(table.headers).toEqual(['Level', 'Where', 'Problem', 'Detail']);
    for (const row of table.rows) {
      expect(levels(table)).toContain(row[0]);
      expect(row[0]).toMatch(/^(error|warning|note)$/u);
      expect((row[1] ?? '').length).toBeGreaterThan(0);
      expect((row[3] ?? '').length).toBeGreaterThan(10);
    }
  });

  it('reads a config from a File', async () => {
    const file = new File([CONFIG], 'config', { type: 'text/plain' });
    const result = (await tool.run({ files: [file], options: {} })) as Result;
    expect(result.stats?.hostBlocks).toBe(3);
    expect(result.stats?.warnings).toBe(6);
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/no ssh config was provided/i);
  });

  it('rejects a file with no directives', async () => {
    await expect(run('### only a comment')).rejects.toThrow(/no directives were found/i);
    await expect(run('!!!')).rejects.toThrow(/no directives were found/i);
  });

  it('requires a host for the resolve view', async () => {
    await expect(run(CONFIG, { format: 'resolve' })).rejects.toThrow(/no host was given to resolve/i);
  });
});
