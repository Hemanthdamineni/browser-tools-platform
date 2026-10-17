import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './conditional-request-headers.tool';

type Result = {
  output: string;
  filename?: string;
  render?: string;
  language?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const DATE = 'Wed, 21 Oct 2015 07:28:00 GMT';

describe('conditional-request-headers build', () => {
  it('builds a complete conditional set from defaults', () => {
    const result = run('', { mode: 'build', target: 'all' });
    expect(result.filename).toBe('conditional-request-headers.txt');
    expect(result.language).toBe('http');
    expect(result.stats?.headers).toBe(7);
    expect(result.output.split('\n')).toEqual([
      'ETag: "v1-abc123"',
      `Last-Modified: ${DATE}`,
      'If-Match: "v1-abc123"',
      'If-None-Match: "v1-abc123"',
      'If-Range: "v1-abc123"',
      `If-Modified-Since: ${DATE}`,
      `If-Unmodified-Since: ${DATE}`,
    ]);
  });

  it('emits each individual header on request', () => {
    expect(run('', { mode: 'build', target: 'etag', etag: '"v1-abc123"' }).output).toBe(
      'ETag: "v1-abc123"',
    );
    expect(run('', { mode: 'build', target: 'last-modified', date: DATE }).output).toBe(
      `Last-Modified: ${DATE}`,
    );
    expect(run('', { mode: 'build', target: 'if-match', etag: '"v1-abc123"' }).output).toBe(
      'If-Match: "v1-abc123"',
    );
    expect(run('', { mode: 'build', target: 'if-none-match', etag: '"v1-abc123"' }).output).toBe(
      'If-None-Match: "v1-abc123"',
    );
    expect(run('', { mode: 'build', target: 'if-range', etag: '"v1-abc123"' }).output).toBe(
      'If-Range: "v1-abc123"',
    );
    expect(
      run('', { mode: 'build', target: 'if-range', validatorType: 'date', date: DATE }).output,
    ).toBe(`If-Range: ${DATE}`);
    expect(run('', { mode: 'build', target: 'if-modified-since', date: DATE }).output).toBe(
      `If-Modified-Since: ${DATE}`,
    );
    expect(run('', { mode: 'build', target: 'if-unmodified-since', date: DATE }).output).toBe(
      `If-Unmodified-Since: ${DATE}`,
    );
  });

  it('builds weak tags and wildcard conditions', () => {
    expect(run('', { mode: 'build', target: 'etag', etag: '"v1"', weak: true }).output).toBe(
      'ETag: W/"v1"',
    );
    expect(
      run('', { mode: 'build', target: 'if-none-match', etag: '"v1"', weak: true }).output,
    ).toBe('If-None-Match: W/"v1"');
    expect(run('', { mode: 'build', target: 'if-match', wildcard: true }).output).toBe(
      'If-Match: *',
    );
    expect(run('', { mode: 'build', target: 'if-none-match', wildcard: true }).output).toBe(
      'If-None-Match: *',
    );
  });

  it('keeps an already-weak tag and warns about weak If-Match', () => {
    expect(run('', { mode: 'build', target: 'etag', etag: 'W/"v1"' }).output).toBe('ETag: W/"v1"');
    const weak = run('', { mode: 'build', target: 'if-match', etag: 'W/"v1"' });
    expect(weak.output).toBe('If-Match: W/"v1"');
    expect(weak.notes?.join(' ')).toContain('strong comparison');
  });

  it('rejects wildcard and weak modes combined', () => {
    expect(() =>
      run('', { mode: 'build', target: 'if-match', wildcard: true, weak: true }),
    ).toThrow(ToolError);
    expect(() => run('', { mode: 'build', target: 'all', wildcard: true, weak: true })).toThrow(
      ToolError,
    );
  });

  it('rejects an ETag or If-Range wildcard and a weak If-Range validator', () => {
    expect(() => run('', { mode: 'build', target: 'etag', etag: '*' })).toThrow(/wildcard/);
    expect(() => run('', { mode: 'build', target: 'if-range', etag: '*' })).toThrow(/wildcard/);
    expect(() => run('', { mode: 'build', target: 'if-range', etag: 'W/"v1"' })).toThrow(
      /strong entity-tag/,
    );
  });

  it('rejects malformed entity-tags', () => {
    expect(() => run('', { mode: 'build', target: 'etag', etag: 'v1' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', target: 'if-match', etag: 'bad-tag' })).toThrow(
      ToolError,
    );
    expect(() => run('', { mode: 'build', target: 'etag', etag: '"a\nb"' })).toThrow(ToolError);
  });

  it('rejects malformed generated dates and obsolete forms', () => {
    expect(() => run('', { mode: 'build', target: 'last-modified', date: 'not a date' })).toThrow(
      ToolError,
    );
    expect(() =>
      run('', { mode: 'build', target: 'if-modified-since', date: '2024-01-01T00:00:00Z' }),
    ).toThrow(ToolError);
    expect(() =>
      run('', {
        mode: 'build',
        target: 'if-unmodified-since',
        date: 'Sunday, 06-Nov-94 08:49:37 GMT',
      }),
    ).toThrow(ToolError);
  });

  it('notes the method-sensitive If-None-Match response', () => {
    expect(
      run('', { mode: 'build', target: 'if-none-match', method: 'GET' }).notes?.join(' '),
    ).toContain('304');
    expect(
      run('', { mode: 'build', target: 'if-none-match', method: 'PUT' }).notes?.join(' '),
    ).toContain('412');
  });

  it('builds a Unicode entity-tag', () => {
    expect(run('', { mode: 'build', target: 'etag', etag: '"café"' }).output).toBe('ETag: "café"');
  });

  it('rejects an unsupported mode or header', () => {
    expect(() => run('', { mode: 'nonsense' })).toThrow(/supported conditional-request mode/);
    expect(() => run('', { mode: 'build', target: 'unknown' })).toThrow(
      /supported conditional header/,
    );
  });
});

describe('conditional-request-headers analyze', () => {
  it('returns an empty table with guidance for blank input', () => {
    const all = run('');
    expect(all.render).toBe('table');
    expect(rows(all)).toEqual([]);
    expect(all.notes?.[0]).toContain('Paste');
    const one = run('', { target: 'if-range' });
    expect(rows(one)).toEqual([]);
    expect(one.notes?.[0]).toContain('Paste');
  });

  it('analyzes ETag values, including weak and wildcard tags', () => {
    const result = run('W/"abc", "def", *', { target: 'etag' });
    expect(rows(result)).toEqual([
      ['W/"abc"', 'weak', 'abc', 'Valid'],
      ['"def"', 'strong', 'def', 'Valid'],
      ['*', 'wildcard', '', 'Valid'],
    ]);
    expect(result.stats).toMatchObject({ tags: 3, invalid: 0, wildcard: 1 });
  });

  it('flags malformed and unquoted ETags', () => {
    const result = run('"ok", broken\nw/"lower"', { target: 'etag' });
    expect(result.stats).toMatchObject({ tags: 3, invalid: 2 });
    expect(rows(result)[1]?.[3]).toBe('Invalid ETag');
    expect(rows(result)[2]?.[3]).toBe('Invalid ETag');
  });

  it('analyzes If-Match with strong-comparison rules', () => {
    const result = run('"v1-abc123"\n*', { target: 'if-match' });
    expect(result.stats).toMatchObject({ tags: 2, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[2]).toContain('Strong');
    expect(rows(result)[1]?.[2]).toContain('Wildcard');
  });

  it('flags weak, malformed and duplicate If-Match tags', () => {
    const result = run('W/"v1"\nW/"v1"\nbad-tag', { target: 'if-match' });
    expect(result.stats).toMatchObject({ tags: 3, invalid: 1, review: 2 });
    expect(rows(result)[0]?.[2]).toContain('Weak');
    expect(rows(result)[2]?.[1]).toBe('Invalid');
  });

  it('analyzes If-None-Match and allows weak comparison', () => {
    const result = run('"v1"\nW/"v2"\n*', { target: 'if-none-match' });
    expect(result.stats).toMatchObject({ tags: 3, invalid: 0, review: 0 });
    expect(rows(result)[1]?.[2]).toContain('Weak');
    expect(rows(result)[2]?.[2]).toContain('Wildcard');
  });

  it('flags duplicate and malformed If-None-Match tags', () => {
    const result = run('"v1"\n"v1"\nbad-tag', { target: 'if-none-match' });
    expect(result.stats).toMatchObject({ tags: 3, invalid: 1, review: 2 });
    expect(rows(result)[0]?.[1]).toBe('Review');
    expect(rows(result)[2]?.[1]).toBe('Invalid');
  });

  it('analyzes If-Range validators', () => {
    expect(run('"v1"', { target: 'if-range' }).stats).toMatchObject({
      validators: 1,
      invalid: 0,
      review: 0,
    });
    expect(run(DATE, { target: 'if-range' }).stats).toMatchObject({ invalid: 0, review: 0 });
    expect(rows(run(DATE, { target: 'if-range' }))[0]?.[2]).toBe('IMF-fixdate');
  });

  it('rejects weak and malformed If-Range validators in analysis', () => {
    const weak = run('W/"v1"', { target: 'if-range' });
    expect(weak.stats?.review).toBe(1);
    expect(rows(weak)[0]?.[3]).toContain('Weak');
    expect(run('not-a-validator', { target: 'if-range' }).stats?.invalid).toBe(1);
  });

  it('analyzes HTTP dates for Last-Modified and both If-*-Since headers', () => {
    for (const target of ['last-modified', 'if-modified-since', 'if-unmodified-since']) {
      const result = run(DATE, { target });
      expect(result.stats).toMatchObject({ dates: 1, invalid: 0, review: 0 });
      expect(rows(result)[0]?.[1]).toBe('Valid');
      const obsolete = run('Sunday, 06-Nov-94 08:49:37 GMT', { target });
      expect(obsolete.stats?.review).toBe(1);
      expect(rows(obsolete)[0]?.[2]).toContain('IMF-fixdate');
      expect(rows(run('not a date', { target }))[0]?.[1]).toBe('Invalid');
      expect(run('Thu, 29 Feb 2024 12:00:00 GMT', { target }).stats?.invalid).toBe(0);
    }
  });

  it('analyzes a header block covering every conditional header', () => {
    const result = run(
      [
        'ETag: "v1-abc123"',
        `Last-Modified: ${DATE}`,
        'If-Match: "v1-abc123"',
        'If-None-Match: W/"v1-abc123"',
        'If-Range: "v1-abc123"',
        `If-Modified-Since: ${DATE}`,
        `If-Unmodified-Since: ${DATE}`,
      ].join('\n'),
    );
    expect(result.stats).toMatchObject({ headers: 7, invalid: 0, review: 0 });
    expect(rows(result).map((row) => row[0])).toEqual([
      'ETag',
      'Last-Modified',
      'If-Match',
      'If-None-Match',
      'If-Range',
      'If-Modified-Since',
      'If-Unmodified-Since',
    ]);
  });

  it('flags invalid and duplicate header lines in a block', () => {
    const result = run('ETag: *\nETag: "v1"\nLast-Modified: not a date\nIf-Match: bad-tag');
    expect(result.stats?.invalid).toBeGreaterThan(0);
    expect(result.notes?.join(' ').toLowerCase()).toContain('duplicate');
    expect(rows(result).some((row) => row[2] === 'Invalid')).toBe(true);
  });

  it('falls back to value analysis with a hint when no header names are present', () => {
    const tags = run('W/"abc", "def"');
    expect(tags.notes?.[0]).toContain('entity-tags');
    expect(rows(tags)[0]?.[1]).toBe('weak');
    const dates = run(`${DATE}\nThu, 29 Feb 2024 12:00:00 GMT`);
    expect(dates.notes?.[0]).toContain('HTTP dates');
    expect(dates.stats).toMatchObject({ dates: 2, invalid: 0 });
  });

  it('prefers block analysis even when a single header is selected', () => {
    const result = run('ETag: "x"', { target: 'if-range' });
    expect(rows(result)[0]?.[0]).toBe('ETag');
    expect(result.stats).toMatchObject({ headers: 1, invalid: 0 });
  });

  it('round-trips a built set into a clean analysis', () => {
    const built = run('', {
      mode: 'build',
      target: 'all',
      etag: '"v1-abc123"',
      date: DATE,
      validatorType: 'date',
    });
    const parsed = run(built.output);
    expect(built.stats?.headers).toBe(7);
    expect(parsed.stats).toMatchObject({ headers: 7, invalid: 0, review: 0 });
    expect(rows(parsed).every((row) => row[2] === 'Valid')).toBe(true);
  });

  it('rejects oversized input', () => {
    expect(() => run('x'.repeat(100_001))).toThrow(/too large/);
  });
});

describe('conditional-request-headers compare', () => {
  it('compares weak and strong validators correctly', () => {
    expect(run('W/"abc"', { mode: 'compare', secondTag: '"abc"' }).output).toBe('Match');
    expect(
      run('W/"abc"', { mode: 'compare', secondTag: '"abc"', comparison: 'strong' }).output,
    ).toBe('No match');
    expect(run('"abc"', { mode: 'compare', secondTag: '*' }).output).toBe('Match');
    expect(run('"abc"', { mode: 'compare', secondTag: '"def"' }).output).toBe('No match');
  });

  it('rejects malformed comparison operands', () => {
    expect(() => run('abc', { mode: 'compare', secondTag: '"abc"' })).toThrow(ToolError);
    expect(() => run('"abc"', { mode: 'compare', secondTag: 'def' })).toThrow(ToolError);
  });
});
