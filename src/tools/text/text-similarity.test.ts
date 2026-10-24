import { describe, expect, it } from 'vitest';
import tool from './text-similarity.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(text, options);
  return { r, parsed: JSON.parse(r.output) as Table };
};

const THUMBS_UP = '\uD83D\uDC4D';
const THUMBS_DOWN = '\uD83D\uDC4E';

describe('text-similarity', () => {
  it('computes the classic Levenshtein example', async () => {
    const { parsed } = await table('kitten\nsitting');
    expect(parsed.headers[2]).toBe('Distance');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.[2]).toBe('3');
    expect(parsed.rows[0]?.[3]).toBe('57.1%');
  });

  it('reports identical strings as distance zero', async () => {
    const { parsed } = await table('same\nsame');
    expect(parsed.rows[0]?.[2]).toBe('0');
    expect(parsed.rows[0]?.[3]).toBe('100.0%');
  });

  it('counts an adjacent swap as one edit with Damerau-Levenshtein', async () => {
    const lev = await table('ca\nac');
    expect(lev.parsed.rows[0]?.[2]).toBe('2');
    const dam = await table('ca\nac', { metric: 'damerau' });
    expect(dam.parsed.rows[0]?.[2]).toBe('1');
  });

  it('matches the canonical Jaro-Winkler values', async () => {
    const martha = await table('MARTHA\nMARHTA', { metric: 'jaro-winkler' });
    expect(martha.parsed.rows[0]?.[3]).toBe('96.1%');
    expect(martha.parsed.rows[0]?.[2]).toBe('n/a');
    const dixon = await table('DIXON\nDICKSONX', { metric: 'jaro-winkler' });
    expect(dixon.parsed.rows[0]?.[3]).toBe('81.3%');
  });

  it('treats an astral character as a single unit', async () => {
    const { parsed } = await table(THUMBS_UP + '\n' + THUMBS_DOWN);
    expect(parsed.rows[0]?.[2]).toBe('1');
  });

  it('is case-insensitive by default and case-sensitive on request', async () => {
    const loose = await table('Hello\nhello');
    expect(loose.parsed.rows[0]?.[2]).toBe('0');
    const strict = await table('Hello\nhello', { caseSensitive: true });
    expect(strict.parsed.rows[0]?.[2]).toBe('1');
    expect(strict.parsed.rows[0]?.[3]).toBe('80.0%');
  });

  it('sorts closest matches first by default', async () => {
    const { parsed } = await table('cat\ndog\ncats');
    expect(parsed.rows[0]?.[1]).toBe('cats');
    expect(parsed.rows[1]?.[1]).toBe('dog');
  });

  it('keeps input order when asked', async () => {
    const { parsed } = await table('cat\ndog\ncats', { sort: 'input' });
    expect(parsed.rows[0]?.[1]).toBe('dog');
    expect(parsed.rows[1]?.[1]).toBe('cats');
  });

  it('limits rows and says how many were hidden', async () => {
    const { r, parsed } = await table('ref\nr1\nr2\nr3', { limit: 2 });
    expect(parsed.rows).toHaveLength(2);
    expect(r.notes?.join(' ')).toMatch(/showing 2 of 3 lines/i);
  });

  it('compares every line against a supplied reference', async () => {
    const { r, parsed } = await table('cat\ndog', { reference: 'cats' });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.[1]).toBe('cat');
    expect(parsed.rows[0]?.[3]).toBe('75.0%');
    expect(r.notes?.join(' ')).toMatch(/reference is the text you supplied/i);
  });

  it('skips blank lines', async () => {
    const { parsed } = await table('cat\n\n\ndog');
    expect(parsed.rows).toHaveLength(1);
  });

  it('supports a plain-text lines format', async () => {
    const r = await run('kitten\nsitting', { format: 'lines' });
    expect(r.render).toBe('code');
    expect(r.output).toContain('57.1%');
    expect(r.output).toContain('d=3');
  });

  it('reports summary stats', async () => {
    const r = await run('same\nsame\nother');
    expect(r.stats?.linesCompared).toBe(2);
    expect(r.stats?.exactMatches).toBe(1);
    expect(r.stats?.closestMatch).toBe('100.0%');
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/paste some text/i);
  });

  it('asks for a second line when there is nothing to compare', async () => {
    await expect(run('lonely')).rejects.toThrow(/second line/i);
  });

  it('normalizes CRLF line endings and trims trailing whitespace', async () => {
    const { parsed } = await table('Colour\r\n\r\ncolour \r\ncolur');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.[1]).toBe('colour');
    expect(parsed.rows[0]?.[2]).toBe('0');
  });

  it('folds case for non-ASCII scripts', async () => {
    const { parsed } = await table(
      '\u041f\u0440\u0438\u0432\u0435\u0442\n\u043f\u0440\u0438\u0432\u0435\u0442',
    );
    expect(parsed.rows[0]?.[2]).toBe('0');
  });

  it('scores a candidate that equals the supplied reference at 100%', async () => {
    const { parsed } = await table('cat\ndog', { reference: 'dog' });
    expect(parsed.rows[0]?.[1]).toBe('dog');
    expect(parsed.rows[0]?.[3]).toBe('100.0%');
  });

  it('warns that Jaro-Winkler has no edit distance', async () => {
    const { r } = await table('abc\nabd', { metric: 'jaro-winkler' });
    expect(r.warnings?.join(' ')).toMatch(/score between 0 and 1/i);
  });

  it('rejects a pair too long for an exact quadratic comparison', async () => {
    const huge = 'x'.repeat(3000) + '\n' + 'y'.repeat(3000);
    await expect(run(huge)).rejects.toThrow(/too long/i);
  });

  it('handles a few hundred lines in one batch', async () => {
    const ref = 'a'.repeat(20);
    const lines = Array.from(
      { length: 300 },
      (_, i) => ref.slice(0, 17) + String(i).padStart(3, '0'),
    );
    const { parsed } = await table(ref + '\n' + lines.join('\n'), { limit: 5000 });
    expect(parsed.rows).toHaveLength(300);
  });
});
