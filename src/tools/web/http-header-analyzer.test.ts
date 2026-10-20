import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import { meta } from './http-header-analyzer.meta';
import tool from './http-header-analyzer.tool';
import { FAMILIES } from './http-header-analyzer.families';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

/** Analyze a single header value with its family preselected. */
const analyze = (family: string, value: string) => run(value, { header: family });

const rowOf = (result: Result, index = 0) => rows(result)[index] ?? [];
const status = (result: Result, index = 0) => rowOf(result, index)[3] ?? '';
const assessment = (result: Result, index = 0) => rowOf(result, index)[4] ?? '';
const details = (result: Result, index = 0) => rowOf(result, index)[2] ?? '';

describe('http-header-analyzer', () => {
  it('auto-detects every header in a pasted block', () => {
    const result = run(
      [
        'HTTP/1.1 200 OK',
        'Content-Type: text/html',
        'Alt-Used: edge.example.net:443',
        'Priority: u=3, i',
        'X-Custom-Thing: hello',
      ].join('\n'),
    );
    expect(rows(result)).toHaveLength(4);
    expect(rowOf(result, 0)[0]).toBe('Content-Type');
    expect(status(result, 0)).toBe('Generic');
    expect(rowOf(result, 1)[0]).toBe('Alt-Used');
    expect(status(result, 1)).toBe('Valid');
    expect(rowOf(result, 2)[0]).toBe('Priority');
    expect(details(result, 2)).toContain('urgency=3');
    expect(rowOf(result, 3)[0]).toBe('X-Custom-Thing');
    expect(status(result, 3)).toBe('Generic');
    expect(result.stats).toMatchObject({ headers: 4, unknown: 2 });
  });

  it('ignores the start line and the body of a raw response', () => {
    const result = run('HTTP/1.1 200 OK\nDate: Wed, 21 Oct 2015 07:28:00 GMT\n\n<html></html>');
    expect(rows(result)).toHaveLength(1);
    expect(rowOf(result, 0)[0]).toBe('Date');
    expect(result.notes?.join(' ')).toContain('body');
  });

  it('returns guidance for empty input instead of failing', () => {
    const result = run('');
    expect(rows(result)).toEqual([]);
    expect(result.notes?.[0]).toContain('Paste');
  });

  it('rejects a malformed header line with a clear error', () => {
    expect(() => run('Content-Type text/html')).toThrow(ToolError);
    expect(() => run('Content-Type text/html')).toThrow(/not a valid header line/);
  });

  it('rejects an invalid header name', () => {
    expect(() => run('Bad Header: value')).toThrow(ToolError);
    expect(() => run('Bad Header: value')).toThrow(/not a valid header name/);
  });

  it('matches header names case-insensitively and shows the canonical name', () => {
    const result = run('aLt-used: edge.example.net');
    expect(rowOf(result, 0)[0]).toBe('Alt-Used');
    expect(status(result, 0)).toBe('Valid');
  });

  it('reports duplicated headers', () => {
    const result = run('Vary: Accept\nVary: Accept-Encoding');
    expect(result.stats).toMatchObject({ headers: 2, duplicates: 1 });
    expect(result.notes?.join(' ')).toContain('appears 2 times');
  });

  it('keeps a folded continuation line with its header', () => {
    const result = run('X-Long: first\n  second');
    expect(rowOf(result, 0)[1]).toBe('first second');
  });

  it('flags non-ASCII values as obs-text', () => {
    const result = run('X-Note: café');
    expect(result.notes?.join(' ')).toContain('obs-text');
  });

  it('handles a very long header list without losing rows', () => {
    const block = Array.from(
      { length: 2000 },
      (_, index) => `X-Item-${index}: value-${index}`,
    ).join('\n');
    const result = run(block);
    expect(result.stats).toMatchObject({ headers: 2000 });
    expect(rows(result)).toHaveLength(2000);
  });

  it('rejects oversized input', () => {
    expect(() => run(`X-Large: ${'a'.repeat(100_001)}`)).toThrow(ToolError);
  });

  it('flags deprecated headers with a reason', () => {
    const md5 = run('Content-MD5: Q2hlY2sgSW50ZWdyaXR5IQ==');
    expect(status(md5)).toBe('Deprecated');
    expect(assessment(md5)).toContain('RFC 7231');

    const warning = run('Warning: 199 misc "cache miss"');
    expect(status(warning)).toBe('Deprecated');
    expect(assessment(warning)).toContain('RFC 9111');
    expect(rowOf(warning)[0]).toBe('Warning');
  });

  it('can stop on the first invalid value', () => {
    expect(() => run('Early-Data: 1', { onInvalid: 'error' })).toThrow(ToolError);
    expect(() => run('Early-Data: 1', { onInvalid: 'error' })).toThrow(/Early-Data/);
  });

  it('reports invalid values in the table by default', () => {
    const result = run('Early-Data: 1');
    expect(status(result)).toBe('Invalid');
    expect(assessment(result)).toContain('must be exactly 0');
    expect(result.stats).toMatchObject({ issues: 2 });
  });

  it('can hide headers without a dedicated parser', () => {
    const result = run('X-Custom: 1\nAlt-Used: edge.example.net', { includeUnknown: false });
    expect(rows(result)).toHaveLength(1);
    expect(rowOf(result, 0)[0]).toBe('Alt-Used');
  });

  it('can sort the rows by header name', () => {
    const result = run('Priority: u=1\nAlt-Used: edge.example.net', { sort: true });
    expect(rowOf(result, 0)[0]).toBe('Alt-Used');
    expect(rowOf(result, 1)[0]).toBe('Priority');
  });

  it('rejects an unknown header selection', () => {
    expect(() => run('x', { header: 'nope' })).toThrow(ToolError);
  });

  it('accepts an empty value but flags control characters', () => {
    const empty = run('X-Empty:');
    expect(status(empty)).toBe('Generic');
    expect(allNotes(empty)).toContain('empty value');

    const control = run('X-Bad: a\u0007b');
    expect(status(control)).toBe('Invalid');
    expect(assessment(control)).toContain('control characters');
  });

  it('needs a header line in auto mode', () => {
    expect(() => run('u=3, i')).toThrow(ToolError);
    expect(() => run('u=3, i')).toThrow(/not a valid header line/);
  });

  it('parses a large block quickly', () => {
    const block = Array.from(
      { length: 1800 },
      (_, index) => `X-Header-${index}: ${'value'.repeat(8)}`,
    ).join('\n');
    const started = performance.now();
    const result = run(block);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.stats).toMatchObject({ headers: 1800 });
  });
});

/** All notes of a result as one string. */
function allNotes(result: Result): string {
  return (result.notes ?? []).join(' | ');
}

describe('http-header-analyzer families', () => {
  it('alt-used: accepts a host and rejects a wildcard authority', () => {
    const ok = analyze('alt-used', 'edge.example.net:443');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('host=edge.example.net');
    expect(details(ok)).toContain('port=443');

    const wild = analyze('alt-used', '*');
    expect(status(wild)).toBe('Invalid');
    expect(assessment(wild)).toContain('Wildcard');

    const url = analyze('alt-used', 'https://edge.example.net');
    expect(assessment(url)).toContain('omit the scheme');
  });

  it('strips a pasted header name in single-header mode', () => {
    const result = analyze('alt-used', 'Alt-Used: edge.example.net');
    expect(rowOf(result)[1]).toBe('edge.example.net');
    expect(status(result)).toBe('Valid');
  });

  it('early-data: only the 0 signal is valid', () => {
    expect(status(analyze('early-data', '0'))).toBe('Valid');
    const bad = analyze('early-data', '1');
    expect(status(bad)).toBe('Invalid');
    expect(assessment(bad)).toContain('exactly 0');
  });

  it('trailer: names fields and flags forbidden ones', () => {
    const ok = analyze('trailer', 'Expires, X-Checksum');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('field=expires');

    const bad = analyze('trailer', 'Content-Length, content-length');
    expect(assessment(bad)).toContain('Not permitted in trailers');
    expect(assessment(bad)).toContain('Duplicate');
  });

  it('priority: reads urgency and incremental', () => {
    const ok = analyze('priority', 'u=3, i');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('urgency=3');
    expect(details(ok)).toContain('incremental=true');

    const bad = analyze('priority', 'u=9');
    expect(assessment(bad)).toContain('urgency must be an integer');
  });

  it('signature-input: reads the label, components and parameters', () => {
    const ok = analyze(
      'signature-input',
      'sig1=("@method" "@path");created=1618884473;keyid="test"',
    );
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('label=sig1');
    expect(details(ok)).toContain('component=@method');
    expect(details(ok)).toContain('keyid="test"');

    const noKey = analyze('signature-input', 'sig1=("@method")');
    expect(assessment(noKey)).toContain('keyid is recommended');

    const broken = analyze('signature-input', 'not-a-signature');
    expect(status(broken)).toBe('Invalid');
  });

  it('tracestate: reads vendor entries and limits them', () => {
    const ok = analyze('tracestate', 'rojo=00f067aa0ba902b7, congo=t61rcWkgMzE');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('rojo=00f067aa0ba902b7');

    const dupe = analyze('tracestate', 'rojo=1, rojo=2');
    expect(assessment(dupe)).toContain('Duplicate vendor key');

    const many = analyze(
      'tracestate',
      Array.from({ length: 33 }, (_, index) => `k${index}=v`).join(', '),
    );
    expect(assessment(many)).toContain('at most 32 list-members');
  });

  it('traceparent: checks the four hexadecimal fields', () => {
    const ok = analyze('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('sampled=yes');

    const bad = analyze('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7');
    expect(status(bad)).toBe('Invalid');
    expect(assessment(bad)).toContain('separated by hyphens');
  });

  it('warning: decodes the warn-code', () => {
    const result = analyze('warning', '199 misc "cache miss"');
    expect(status(result)).toBe('Deprecated');
    expect(details(result)).toContain('warn-code=199');
    expect(details(result)).toContain('warn-text=cache miss');
  });

  it('date: wants an IMF-fixdate', () => {
    expect(status(analyze('date', 'Wed, 21 Oct 2015 07:28:00 GMT'))).toBe('Valid');
    expect(assessment(analyze('date', 'Wed, 21 Oct 2015 07:28:00'))).toContain('IMF-fixdate');
  });

  it('retry-after: reads seconds or an HTTP-date', () => {
    const seconds = analyze('retry-after', '120');
    expect(details(seconds)).toContain('form=delta-seconds');
    const date = analyze('retry-after', 'Wed, 21 Oct 2015 07:28:00 GMT');
    expect(details(date)).toContain('form=HTTP-date');
    const bad = analyze('retry-after', 'soon');
    expect(status(bad)).toBe('Invalid');
  });

  it('link: needs a rel parameter', () => {
    const ok = analyze('link', '</style.css>; rel=preload; as=style');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('rel=preload');

    const bad = analyze('link', '</style.css>');
    expect(assessment(bad)).toContain('Missing rel parameter');
  });

  it('upgrade: reads protocol and version', () => {
    const ok = analyze('upgrade', 'websocket');
    expect(details(ok)).toContain('protocol=websocket');
    const bad = analyze('upgrade', 'http/2.0');
    expect(assessment(bad)).toContain('HTTP/2 and HTTP/3');
  });

  it('prefer: validates the wait preference', () => {
    expect(status(analyze('prefer', 'wait=100, respond-async'))).toBe('Valid');
    expect(assessment(analyze('prefer', 'wait=99999'))).toContain('0 to 86400');
  });

  it('allow: checks the method list', () => {
    expect(status(analyze('allow', 'GET, HEAD, POST'))).toBe('Valid');
    expect(assessment(analyze('allow', 'GET, GET'))).toContain('Duplicate methods');
    expect(assessment(analyze('allow', 'GET, *'))).toContain('Wildcard');
  });

  it('connection: flags hop-by-hop tokens that need care', () => {
    expect(status(analyze('connection', 'upgrade'))).toBe('Valid');
    expect(assessment(analyze('connection', 'authorization'))).toContain('proxy handling');
  });

  it('origin: accepts an origin or the null origin', () => {
    expect(status(analyze('origin', 'https://example.com'))).toBe('Valid');
    expect(status(analyze('origin', 'null'))).toBe('Valid');
    const bad = analyze('origin', 'https://example.com/path');
    expect(status(bad)).toBe('Invalid');
    expect(assessment(bad)).toContain('never contain paths');
  });

  it('expect: only 100-continue is interoperable', () => {
    expect(status(analyze('expect', '100-continue'))).toBe('Valid');
    expect(assessment(analyze('expect', '200-ok'))).toContain('interoperability');
  });

  it('via: needs a received-by host', () => {
    const ok = analyze('via', 'HTTP/1.1 proxy.example.com');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('received-by=proxy.example.com');
    const bad = analyze('via', 'HTTP/1.1');
    expect(status(bad)).toBe('Invalid');
  });

  it('forwarded: requires the for parameter', () => {
    const ok = analyze('forwarded', 'for=192.0.2.60;proto=https;by=203.0.113.43');
    expect(status(ok)).toBe('Valid');
    expect(assessment(analyze('forwarded', 'proto=https'))).toContain('Missing required for');
  });

  it('server-timing: reads metrics and their duration', () => {
    const ok = analyze('server-timing', 'db;dur=12.5, cache;desc="Hit cache"');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('db.dur=12.5');
    expect(assessment(analyze('server-timing', 'db;dur=abc'))).toContain('non-negative number');
  });

  it('accept-ch: warns about high-entropy hints', () => {
    expect(status(analyze('accept-ch', 'Sec-CH-UA, DPR'))).toBe('Valid');
    expect(assessment(analyze('accept-ch', 'Device-Memory'))).toContain('fingerprinting');
  });

  it('critical-ch: warns about high-entropy critical hints', () => {
    expect(status(analyze('critical-ch', 'Sec-CH-UA'))).toBe('Valid');
    expect(assessment(analyze('critical-ch', 'Sec-CH-UA-Model'))).toContain('fingerprinting');
  });

  it('alt-svc: reads the protocol, authority and lifetime', () => {
    const ok = analyze('alt-svc', 'h3=":443"; ma=2592000');
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('authority=:443');
    expect(details(ok)).toContain('ma=2592000');
    const bad = analyze('alt-svc', 'h3=":443"; ma=99999999');
    expect(assessment(bad)).toContain('ma must be');
  });

  it('timing-allow-origin: warns about the wildcard', () => {
    expect(status(analyze('timing-allow-origin', 'https://example.com'))).toBe('Valid');
    expect(assessment(analyze('timing-allow-origin', '*'))).toContain('every origin');
  });

  it('content-digest: checks the algorithm and digest length', () => {
    const digest = 'sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:';
    const ok = analyze('content-digest', digest);
    expect(status(ok)).toBe('Valid');
    const bad = analyze('content-digest', 'sha-256=:short:');
    expect(assessment(bad)).toContain('44 characters');
  });

  it('network-error-logging: validates the policy JSON', () => {
    const ok = analyze(
      'network-error-logging',
      '{"report_to":"default","max_age":86400,"include_subdomains":true}',
    );
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('report_to=default');

    const bad = analyze('network-error-logging', '{"max_age":86400}');
    expect(assessment(bad)).toContain('report_to');

    expect(status(analyze('network-error-logging', 'not json'))).toBe('Invalid');
  });

  it('reporting-endpoints: requires a quoted https URL', () => {
    const ok = analyze('reporting-endpoints', 'default="https://reports.example.com/collect"');
    expect(status(ok)).toBe('Valid');
    const bad = analyze('reporting-endpoints', 'default="http://reports.example.com/collect"');
    expect(assessment(bad)).toContain('https');
  });

  it('sunset and deprecation: read the date', () => {
    const future = new Date(Date.now() + 86400000 * 30).toUTCString();
    const sunset = analyze('sunset', future);
    expect(status(sunset)).toBe('Valid');
    expect(details(sunset)).toContain('date=');

    const past = analyze('deprecation', 'Wed, 21 Oct 2015 07:28:00 GMT');
    expect(status(past)).toBe('Valid');
  });

  it('speculation-rules: reads prefetch and prerender rules', () => {
    const ok = analyze(
      'speculation-rules',
      '{"prefetch":[{"source":"list","urls":["/next"],"eagerness":"moderate"}]}',
    );
    expect(status(ok)).toBe('Valid');
    expect(details(ok)).toContain('prefetch=1 url(s)');

    const broken = analyze('speculation-rules', '{not json');
    expect(status(broken)).toBe('Invalid');
  });

  it('x-robots-tag: reads the directives and flags conflicts', () => {
    expect(status(analyze('x-robots-tag', 'noindex, nofollow'))).toBe('Valid');
    expect(assessment(analyze('x-robots-tag', 'index, noindex'))).toContain('Conflicting');
    expect(assessment(analyze('x-robots-tag', 'nonsense'))).toContain('Unknown directive');
  });
});

describe('http-header-analyzer metadata', () => {
  it('lists every family it can parse in the options', () => {
    const choices = (meta.options ?? []).find((option) => option.key === 'header');
    const values = new Set(
      choices && choices.type === 'select' ? choices.choices.map((choice) => choice.value) : [],
    );
    expect(values.has('auto')).toBe(true);
    for (const family of FAMILIES) expect(values.has(family.id)).toBe(true);
  });

  it('has a summary that fits the card', () => {
    expect(meta.summary.length).toBeLessThanOrEqual(120);
    expect(meta.id).toBe('http-header-analyzer');
  });
});
