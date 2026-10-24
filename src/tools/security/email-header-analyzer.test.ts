import { describe, expect, it } from 'vitest';
import tool from './email-header-analyzer.tool';

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
) => {
  const r = await run(text, { ...options, format });
  return { r, parsed: JSON.parse(r.report?.output ?? '{}') as Table };
};

const overview = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const { r, parsed } = await view(text, 'overview', options);
  const map: Record<string, string> = {};
  for (const row of parsed.rows) {
    const key = row[0];
    const value = row[1];
    if (key !== undefined && value !== undefined) map[key] = value;
  }
  return { r, map };
};

const TWO_HOPS = [
  'Return-Path: <alice@example.com>',
  'Received: from mail.example.com (mail.example.com [192.0.2.10])',
  '\tby mx.google.com with ESMTPS id abc123',
  '\tfor <bob@example.org>; Tue, 1 Oct 2024 10:00:05 +0000',
  'Received: from localhost (localhost [127.0.0.1]) by mail.example.com',
  '\twith ESMTP id def456; Tue, 1 Oct 2024 10:00:00 +0000',
  'Authentication-Results: mx.google.com; spf=pass smtp.mailfrom=alice@example.com;',
  '\tdkim=pass header.i=@example.com; dmarc=pass header.from=example.com',
  'From: Alice Example <alice@example.com>',
  'To: Bob <bob@example.org>',
  'Subject: =?UTF-8?B?w4TDpMOWw7w=?= report',
  'Date: Tue, 1 Oct 2024 10:00:04 +0000',
  'Message-ID: <abc123@example.com>',
].join('\n');

describe('email-header-analyzer', () => {
  it('summarizes the key headers of a message', async () => {
    const { r, map } = await overview(TWO_HOPS);
    expect(r.outputs).toEqual([]);
    expect(r.report?.render).toBe('table');
    expect(map.From).toBe('Alice Example <alice@example.com>');
    expect(map.To).toBe('Bob <bob@example.org>');
    expect(map['Return-Path']).toBe('<alice@example.com>');
    expect(map.Date).toBe('2024-10-01T10:00:04.000Z');
    expect(map['Message-ID']).toBe('<abc123@example.com>');
    expect(map.Headers).toBe('9');
    expect(map['Received hops']).toBe('2');
  });

  it('decodes an RFC 2047 encoded-word in the subject', async () => {
    const { map } = await overview(TWO_HOPS);
    expect(map.Subject).toBe('ÄäÖü report');
  });

  it('keeps encoded-words when decoding is switched off', async () => {
    const { map } = await overview(TWO_HOPS, { decodeWords: false });
    expect(map.Subject).toBe('=?UTF-8?B?w4TDpMOWw7w=?= report');
  });

  it('reports transit time and the date against the last hop', async () => {
    const { map } = await overview(TWO_HOPS);
    expect(map['First hop']).toBe('2024-10-01T10:00:00.000Z');
    expect(map['Last hop']).toBe('2024-10-01T10:00:05.000Z');
    expect(map['Transit time']).toBe('5s');
    expect(map['Date vs last hop']).toBe('-1s');
    expect(map['Distinct domains']).toBe('2');
  });

  it('lists hops in delivery order with per hop delays', async () => {
    const { parsed } = await view(TWO_HOPS, 'hops');
    expect(parsed.headers).toEqual(['#', 'From', 'By', 'Protocol', 'Timestamp', 'Delay']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual([
      '1',
      'localhost [127.0.0.1]',
      'mail.example.com',
      'ESMTP',
      '2024-10-01T10:00:00.000Z',
      '-',
    ]);
    expect(parsed.rows[1]?.[1]).toBe('mail.example.com [192.0.2.10]');
    expect(parsed.rows[1]?.[2]).toBe('mx.google.com');
    expect(parsed.rows[1]?.[3]).toBe('ESMTPS');
    expect(parsed.rows[1]?.[5]).toBe('5s');
  });

  it('parses authentication results with their sources', async () => {
    const { parsed } = await view(TWO_HOPS, 'auth');
    expect(parsed.rows).toEqual([
      ['spf', 'pass', 'mx.google.com', 'smtp.mailfrom=alice@example.com'],
      ['dkim', 'pass', 'mx.google.com', 'header.i=@example.com'],
      ['dmarc', 'pass', 'mx.google.com', 'header.from=example.com'],
    ]);
  });

  it('summarizes authentication in the overview', async () => {
    const { map, r } = await overview(TWO_HOPS);
    expect(map.Authentication).toBe('SPF pass, DKIM pass, DMARC pass');
    expect(r.stats?.authChecks).toBe(3);
    expect(r.stats?.authFailures).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it('lists addresses with their roles and domains', async () => {
    const { parsed } = await view(TWO_HOPS, 'addresses');
    expect(parsed.headers).toEqual(['Header', 'Name', 'Address', 'Domain']);
    expect(parsed.rows).toEqual([
      ['from', 'Alice Example', 'alice@example.com', 'example.com'],
      ['return-path', '', 'alice@example.com', 'example.com'],
      ['to', 'Bob', 'bob@example.org', 'example.org'],
    ]);
  });

  it('shows every header in the raw view, undecoded', async () => {
    const { parsed } = await view(TWO_HOPS, 'raw');
    expect(parsed.rows).toHaveLength(9);
    expect(parsed.rows.map((row) => row[0])).toContain('authentication-results');
    const subject = parsed.rows.find((row) => row[0] === 'subject');
    expect(subject?.[1]).toBe('=?UTF-8?B?w4TDpMOWw7w=?= report');
  });

  it('reports statistics and hop guidance notes', async () => {
    const { r } = await overview(TWO_HOPS);
    expect(r.stats).toMatchObject({
      headers: 9,
      hops: 2,
      addresses: 3,
      authChecks: 3,
      authFailures: 0,
      transit: '5s',
    });
    expect(r.notes?.join(' ')).toMatch(/delivery order, oldest first/i);
  });

  it('decodes Q encoded-words and joins adjacent words without the gap', async () => {
    const text = ['From: a@example.com', 'Subject: =?ISO-8859-1?Q?Caf=E9?= =?UTF-8?B?IQ==?='].join(
      '\n',
    );
    const { map } = await overview(text);
    expect(map.Subject).toBe('Café!');
  });

  it('warns about failed authentication', async () => {
    const text = [
      'From: Alice <alice@example.com>',
      'Authentication-Results: mx.example.org; spf=fail smtp.mailfrom=evil.example; dkim=none',
    ].join('\n');
    const { r, map } = await overview(text);
    expect(r.stats?.authFailures).toBe(1);
    expect(r.warnings?.join(' ')).toMatch(/SPF reported "fail"/i);
    expect(map.Authentication).toBe('SPF fail, DKIM none');
  });

  it('warns when From and Return-Path domains differ', async () => {
    const text = ['From: Alice <alice@example.com>', 'Return-Path: <bounce@list.example.net>'].join(
      '\n',
    );
    const { r } = await overview(text);
    expect(r.warnings?.join(' ')).toMatch(/differs from Return-Path domain/i);
  });

  it('notes a differing Reply-To domain', async () => {
    const text = [
      'From: Alice <alice@example.com>',
      'Reply-To: help <support@help.example.net>',
    ].join('\n');
    const { r } = await overview(text);
    expect(r.notes?.join(' ')).toMatch(/Reply-To uses help.example.net/i);
  });

  it('warns about spam flags, unparsable dates and reversed hops', async () => {
    const reversed = [
      'Received: from a.example (a.example [198.51.100.1]) by b.example; Tue, 1 Oct 2024 10:00:00 +0000',
      'Received: from b.example (b.example [198.51.100.2]) by c.example; Tue, 1 Oct 2024 10:00:05 +0000',
      'From: Alice <alice@example.com>',
      'Date: not a date at all',
      'X-Spam-Flag: YES',
    ].join('\n');
    const { r } = await overview(reversed);
    const joined = r.warnings?.join(' ');
    expect(joined).toMatch(/X-Spam-Flag says this message was classified as spam/i);
    expect(joined).toMatch(/Date header could not be parsed/i);
    expect(joined).toMatch(/timestamped before hop 1/i);
  });

  it('reads forwarded headers that were quoted with ">"', async () => {
    const quoted = [
      '> From: Alice <alice@example.com>',
      '> Subject: Forwarded',
      '> Received: from a.example (a.example [198.51.100.1]) by b.example; Tue, 1 Oct 2024 10:00:00 +0000',
    ].join('\n');
    const { r, map } = await overview(quoted);
    expect(map.From).toBe('Alice <alice@example.com>');
    expect(map.Subject).toBe('Forwarded');
    expect(r.stats?.hops).toBe(1);
    expect(r.notes?.join(' ')).toMatch(/unquoted/i);
  });

  it('ignores the body and says so', async () => {
    const text = [
      'From: Alice <alice@example.com>',
      'Subject: Hi',
      '',
      'Body line one',
      'Body line two',
    ].join('\n');
    const { r, map } = await overview(text);
    expect(map.Headers).toBe('2');
    expect(r.notes?.join(' ')).toMatch(/body content .* was ignored \(2 non-empty line\(s\)\)/i);
  });

  it('notes when there are no authentication results', async () => {
    const text = ['From: Alice <alice@example.com>'].join('\n');
    const { r, map } = await overview(text);
    expect(map.Authentication).toBe('none found');
    expect(r.notes?.join(' ')).toMatch(/no authentication-results/i);
    const auth = await view(text, 'auth');
    expect(auth.parsed.rows[0]?.[2]).toBe('-');
  });

  it('reads Received-SPF and ARC-Authentication-Results', async () => {
    const text = [
      'From: Alice <alice@example.com>',
      'Received-SPF: Pass (domain of example.com designates 192.0.2.10 as permitted sender)',
      'ARC-Authentication-Results: i=1; mx.example.net; spf=pass; dkim=pass header.d=example.com',
    ].join('\n');
    const { parsed } = await view(text, 'auth');
    expect(parsed.rows[0]).toEqual([
      'spf',
      'pass',
      'Received-SPF',
      'Pass (domain of example.com designates 192.0.2.10 as permitted sender)',
    ]);
    expect(parsed.rows[1]?.[2]).toBe('mx.example.net');
    expect(parsed.rows[1]?.[0]).toBe('spf');
    expect(parsed.rows[2]?.[0]).toBe('dkim');
  });

  it('warns when the headers do not look like an email', async () => {
    const { r } = await overview('X-Custom: one\nX-Other: two');
    expect(r.warnings?.join(' ')).toMatch(/may not be an email/i);
  });

  it('reads the same content from an .eml File', async () => {
    const file = new File([TWO_HOPS], 'message.eml', { type: 'message/rfc822' });
    const r = (await tool.run({ files: [file], options: {} })) as Result;
    expect(r.stats?.hops).toBe(2);
    expect(r.stats?.headers).toBe(9);
  });

  it('rejects empty input and text without headers', async () => {
    await expect(run('')).rejects.toThrow(/no email headers found/i);
    await expect(run('just some prose without any colons')).rejects.toThrow(
      /no email headers found/i,
    );
  });
});
