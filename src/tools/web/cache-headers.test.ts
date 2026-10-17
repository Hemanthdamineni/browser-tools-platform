import { describe, expect, it } from 'vitest';
import type { TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import tool from './cache-headers.tool';
import { meta } from './cache-headers.meta';
import { getTool, redirectTarget, VISIBLE_TOOLS, SEARCH_INDEX } from '@/lib/registry';
import cacheControlTool from './cache-control.tool';
import cdnCacheControlTool from './cdn-cache-control.tool';
import surrogateControlTool from './surrogate-control.tool';
import expiresTool from './expires-header.tool';
import ageTool from './age-header.tool';
import cacheStatusTool from './cache-status.tool';
import varyTool from './vary-header.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
type Options = Record<string, string | number | boolean>;
const run = (text: string, options: Options = {}) => tool.run({ text, options }) as Result;
const runTool = (mod: TextToolModule, text: string, options: Options = {}) =>
  mod.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];
const DATE = 'Wed, 21 Oct 2030 07:28:00 GMT';

describe('cache-headers — build happy path for every family', () => {
  it('builds a Cache-Control policy', () => {
    const result = run('', {
      header: 'cache-control',
      mode: 'build',
      visibility: 'public',
      maxAge: 31536000,
      immutable: true,
      staleWhileRevalidate: 60,
    });
    expect(result.output).toBe('public, max-age=31536000, immutable, stale-while-revalidate=60');
    expect(result.filename).toBe('cache-control.txt');
  });

  it('builds a CDN-Cache-Control policy', () => {
    const result = run('', {
      header: 'cdn-cache-control',
      mode: 'build',
      cdnDirectives: 'max-age=3600, stale-while-revalidate=60',
    });
    expect(result.output).toBe('max-age=3600, stale-while-revalidate=60');
    expect(result.filename).toBe('cdn-cache-control.txt');
  });

  it('builds a Surrogate-Control policy', () => {
    const result = run('', {
      header: 'surrogate-control',
      mode: 'build',
      surrogateDirectives: 'max-age=3600, content="ESI/1.0"',
    });
    expect(result.output).toBe('max-age=3600, content="ESI/1.0"');
    expect(result.filename).toBe('surrogate-control.txt');
  });

  it('builds an Expires value', () => {
    const result = run('', { header: 'expires', mode: 'build', date: DATE });
    expect(result.output).toBe(DATE);
    expect(result.filename).toBe('expires.txt');
  });

  it('builds an Age value', () => {
    const result = run('', { header: 'age', mode: 'build', seconds: '120' });
    expect(result.output).toBe('Age: 120');
    expect(result.filename).toBe('age-header.txt');
  });

  it('builds a Cache-Status value', () => {
    const result = run('', { header: 'cache-status', mode: 'build', cc: 'CDN', hit: 'hit', ttl: '60', fwd: '' });
    expect(result.output).toBe('CDN; hit; ttl=60');
    expect(result.filename).toBe('cache-status.txt');
  });

  it('builds a Vary value', () => {
    const result = run('', { header: 'vary', mode: 'build', fields: 'Accept-Encoding, Origin' });
    expect(result.output).toBe('accept-encoding, origin');
    expect(result.filename).toBe('vary.txt');
  });
});

describe('cache-headers — analyze happy path for every family', () => {
  it('analyzes Cache-Control and flags contradictions', () => {
    const ok = run('public, max-age=31536000, immutable');
    expect(ok.stats?.issues).toBe(0);
    expect(rows(ok)).toContainEqual(['max-age', '31536000', 'No local issues detected']);

    const bad = run('no-store, public, max-age=60, public, immutable');
    expect(bad.stats?.issues).toBeGreaterThan(0);
    expect(rows(bad)[0]?.[2]).toContain('no-store conflicts');
  });

  it('analyzes CDN-Cache-Control directives', () => {
    const result = run('max-age=3600, public, stale-if-error=86400', { header: 'cdn-cache-control' });
    expect(result.stats).toMatchObject({ directives: 3, issues: 0 });
    expect(rows(result)[1]?.[0]).toBe('public');
  });

  it('analyzes Surrogate-Control directives and quoted content', () => {
    const result = run('max-age=3600, content="ESI/1.0"', { header: 'surrogate-control' });
    expect(result.stats).toMatchObject({ directives: 2, issues: 0 });
    expect(rows(result)[1]?.[0]).toBe('content');
  });

  it('analyzes an Expires date', () => {
    const result = run(DATE, { header: 'expires' });
    expect(result.stats).toMatchObject({ dates: 1, invalid: 0, review: 0 });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('analyzes an Age value', () => {
    const result = run('120', { header: 'age' });
    expect(result.stats).toMatchObject({ valid: 'yes', age: 120 });
    expect(run('700000', { header: 'age' }).stats?.status).toBe('stale');
    expect(run('0', { header: 'age' }).stats?.status).toBe('fresh');
  });

  it('analyzes a Cache-Status report', () => {
    const result = run('CDN; hit; ttl=60; stored', { header: 'cache-status' });
    expect(result.stats?.parameters).toBeGreaterThan(0);
    expect(result.stats?.issues).toBe(0);
    expect(result.notes?.[0]).toContain('CDN');
  });

  it('analyzes Vary fields and wildcard', () => {
    const result = run('Accept-Encoding, Origin', { header: 'vary' });
    expect(result.stats).toMatchObject({ fields: 2, issues: 0, wildcard: 'no' });
    expect(run('*', { header: 'vary' }).stats?.wildcard).toBe('yes');
  });
});

describe('cache-headers — edge cases', () => {
  it('returns guidance for blank analysis input in every family', () => {
    const families = ['cache-control', 'cdn-cache-control', 'surrogate-control', 'expires', 'age', 'cache-status', 'vary'];
    for (const header of families) {
      const result = run('', { header });
      expect(result.notes?.[0], header).toContain('Paste');
      expect(rows(result)).toEqual([]);
    }
  });

  it('flags duplicate and unknown-looking directives', () => {
    const dup = run('max-age=60, max-age=120', { header: 'cdn-cache-control' });
    expect(dup.stats?.issues).toBeGreaterThan(0);
    expect(dup.notes?.join(' ')).toContain('Duplicate');

    const unknown = run('CDN; bogus=1; ttl="bad"', { header: 'cache-status' });
    expect(unknown.stats?.issues).toBeGreaterThan(0);
    expect(unknown.notes?.join(' ')).toContain('Flagged');
  });

  it('flags wildcard combinations, duplicates and authorization in Vary', () => {
    const result = run('*, Origin, Origin', { header: 'vary' });
    expect(result.stats?.issues).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('Wildcard');
    expect(run('Authorization, Bad Field', { header: 'vary' }).notes?.join(' ')).toContain('authorization');
  });

  it('flags a past Expires date and obsolete date forms', () => {
    expect(run('Wed, 21 Oct 2015 07:28:00 GMT', { header: 'expires' }).stats?.review).toBe(1);
    expect(rows(run('Sunday, 06-Nov-94 08:49:37 GMT', { header: 'expires' }))[0]?.[2]).toContain('IMF-fixdate');
  });
});

describe('cache-headers — malformed input raises ToolError', () => {
  it('rejects an unknown header family', () => {
    expect(() => run('', { header: 'bogus' })).toThrow(ToolError);
  });

  it('rejects malformed Cache-Control build options', () => {
    expect(() => run('', { header: 'cache-control', mode: 'build', maxAge: -1 })).toThrow(ToolError);
    expect(() => run('', { header: 'cache-control', mode: 'build', visibility: 'shared' })).toThrow(ToolError);
    expect(() => run('', { header: 'cache-control', mode: 'build', staleWhileRevalidate: 1.5 })).toThrow(ToolError);
  });

  it('rejects malformed CDN-Cache-Control and Surrogate-Control directives', () => {
    expect(() => run('', { header: 'cdn-cache-control', mode: 'build', cdnDirectives: '' })).toThrow(ToolError);
    expect(() => run('', { header: 'cdn-cache-control', mode: 'build', cdnDirectives: 'max-age=soon' })).toThrow(ToolError);
    expect(() => run('', { header: 'cdn-cache-control', mode: 'build', cdnDirectives: 'public=true' })).toThrow(ToolError);
    expect(() => run('', { header: 'surrogate-control', mode: 'build', surrogateDirectives: 'content=ESI' })).toThrow(ToolError);
  });

  it('rejects malformed Expires, Age, Cache-Status and Vary build values', () => {
    expect(() => run('', { header: 'expires', mode: 'build', date: 'not a date' })).toThrow(ToolError);
    expect(() => run('-5', { header: 'age' })).toThrow(ToolError);
    expect(() => run('1.5', { header: 'age' })).toThrow(ToolError);
    expect(() => run('', { header: 'cache-status', mode: 'build', cc: '  ' })).toThrow(ToolError);
    expect(() => run('', { header: 'vary', mode: 'build', fields: '' })).toThrow(ToolError);
    expect(() => run('', { header: 'vary', mode: 'build', fields: '*, Origin' })).toThrow(ToolError);
    expect(() => run('', { header: 'vary', mode: 'build', fields: 'Bad Field' })).toThrow(ToolError);
  });
});

describe('cache-headers — legacy ids delegate with unchanged behaviour', () => {
  it('cache-control delegation', () => {
    const result = runTool(cacheControlTool, '', {
      mode: 'build',
      visibility: 'public',
      maxAge: 31536000,
      immutable: true,
      staleWhileRevalidate: 60,
    });
    expect(result.output).toBe('public, max-age=31536000, immutable, stale-while-revalidate=60');
    expect(result.filename).toBe('cache-control.txt');
    expect(cacheControlTool.meta.id).toBe('cache-control');
  });

  it('cdn-cache-control delegation', () => {
    const result = runTool(cdnCacheControlTool, '', {
      mode: 'build',
      directives: 'max-age=3600, stale-while-revalidate=60',
    });
    expect(result.output).toBe('max-age=3600, stale-while-revalidate=60');
    expect(result.filename).toBe('cdn-cache-control.txt');
  });

  it('surrogate-control delegation', () => {
    const result = runTool(surrogateControlTool, '', { mode: 'build', directives: 'max-age=3600, content="ESI/1.0"' });
    expect(result.output).toBe('max-age=3600, content="ESI/1.0"');
    expect(result.filename).toBe('surrogate-control.txt');
  });

  it('expires-header delegation', () => {
    const result = runTool(expiresTool, '', { mode: 'build', date: DATE });
    expect(result.output).toBe(DATE);
    expect(result.filename).toBe('expires.txt');
  });

  it('age-header delegation', () => {
    const result = runTool(ageTool, '', { mode: 'build', seconds: '120' });
    expect(result.output).toBe('Age: 120');
    expect(result.filename).toBe('age-header.txt');
  });

  it('cache-status delegation', () => {
    const result = runTool(cacheStatusTool, '', { mode: 'build', cc: 'CDN', hit: 'hit', ttl: '60', fwd: '' });
    expect(result.output).toBe('CDN; hit; ttl=60');
    expect(result.filename).toBe('cache-status.txt');
  });

  it('vary-header delegation', () => {
    const result = runTool(varyTool, '', { mode: 'build', fields: 'Accept-Encoding, Origin' });
    expect(result.output).toBe('accept-encoding, origin');
    expect(result.filename).toBe('vary.txt');
  });
});

describe('cache-headers — Unicode and token edges', () => {
  it('rejects non-ASCII directive names but keeps Unicode inside quoted values', () => {
    const bad = run('max-âge=60', { header: 'cache-control' });
    expect(bad.stats?.issues).toBeGreaterThan(0);
    expect(rows(bad).some((row) => row[2]?.includes('Invalid directive name'))).toBe(true);

    const ok = run('public, max-age=60, note="héllo wörld"', { header: 'cache-control' });
    expect(ok.stats?.issues).toBe(0);
    expect(rows(ok)).toContainEqual(['note', '"héllo wörld"', 'No local issues detected']);
  });

  it('flags non-ASCII Vary fields and Cache-Status tokens, and rejects them when building', () => {
    expect(run('X-Ünicode', { header: 'vary' }).stats?.issues).toBe(1);
    expect(run('CDN; hït', { header: 'cache-status' }).stats?.issues).toBeGreaterThan(0);
    expect(() => run('', { header: 'vary', mode: 'build', fields: 'X-Ünicode' })).toThrow(ToolError);
    expect(() =>
      run('', { header: 'cache-status', mode: 'build', cc: 'CDN-É', hit: 'hit', ttl: '', fwd: '' }),
    ).toThrow(ToolError);
  });

  it('accepts only ASCII delta-seconds for Age', () => {
    expect(() => run('１２３', { header: 'age' })).toThrow(ToolError);
    expect(run('123', { header: 'age' }).stats?.age).toBe(123);
  });

  it('handles repeated wildcards and CRLF-separated header values without crashing', () => {
    expect(run('*, *', { header: 'vary' }).stats?.wildcard).toBe('yes');
    expect(run('*, *', { header: 'vary' }).stats?.issues).toBeGreaterThan(0);
    expect(run('max-age=60\r\npublic', { header: 'cache-control' }).stats?.headers).toBe(2);
  });
});

describe('cache-headers — published examples', () => {
  const examples = meta.examples ?? [];

  it('lists runnable examples for the merged families', () => {
    expect(examples.length).toBeGreaterThanOrEqual(5);
    for (const example of examples) {
      expect(() => run(example.input ?? '', example.options ?? {}), example.title).not.toThrow();
    }
  });

  it('routes each example through the family named in its title', () => {
    const cdn = examples.find((ex) => ex.title.includes('CDN-Cache-Control'));
    expect(cdn, 'a CDN-Cache-Control example should exist').toBeTruthy();
    expect(run(cdn!.input ?? '', cdn!.options ?? {}).stats).toMatchObject({ directives: 2, issues: 0 });

    const status = examples.find((ex) => ex.title.includes('Cache-Status'));
    expect(status, 'a Cache-Status example should exist').toBeTruthy();
    expect(run(status!.input ?? '', status!.options ?? {}).stats?.parameters).toBeGreaterThan(0);

    const surrogate = examples.find((ex) => ex.title.includes('Surrogate-Control'));
    expect(surrogate, 'a Surrogate-Control example should exist').toBeTruthy();
    expect(run(surrogate!.input ?? '', surrogate!.options ?? {}).filename).toBe('surrogate-control.txt');

    const vary = examples.find((ex) => ex.title.includes('Vary'));
    expect(vary, 'a Vary example should exist').toBeTruthy();
    expect(run(vary!.input ?? '', vary!.options ?? {}).output).toBe('accept-encoding, origin');
  });
});

describe('cache-headers — alias wiring for the seven merged ids', () => {
  const legacyIds = [
    'cache-control',
    'cdn-cache-control',
    'surrogate-control',
    'expires-header',
    'age-header',
    'cache-status',
    'vary-header',
  ];

  it('exposes cache-headers as the visible, beta replacement', () => {
    const target = getTool('cache-headers');
    expect(target).toBeTruthy();
    expect(target?.meta.hidden).not.toBe(true);
    expect(target?.meta.redirectTo).toBeUndefined();
    expect(target?.meta.category).toBe('web');
    expect(target?.meta.status).toBe('beta');
    expect(target?.meta.input).toBe('text');
  });

  it('keeps every legacy cache id routable as a hidden one-hop redirect', () => {
    for (const id of legacyIds) {
      const legacy = getTool(id);
      expect(legacy, `${id} should still resolve`).toBeTruthy();
      expect(legacy?.meta.hidden, `${id} must be hidden`).toBe(true);
      expect(legacy?.meta.redirectTo, `${id} must redirect`).toBe('cache-headers');
      const target = redirectTarget(legacy!.meta);
      expect(target?.meta.id, `${id} must resolve its target`).toBe('cache-headers');
      expect(target?.meta.redirectTo, `${id} must not chain`).toBeUndefined();
    }
  });

  it('drops the merged ids from listings, search and the sitemap-facing index', () => {
    for (const id of legacyIds) {
      expect(VISIBLE_TOOLS.some((t) => t.meta.id === id)).toBe(false);
      expect(SEARCH_INDEX.some((entry) => entry.id === id)).toBe(false);
    }
    expect(VISIBLE_TOOLS.some((t) => t.meta.id === 'cache-headers')).toBe(true);
    expect(SEARCH_INDEX.some((entry) => entry.id === 'cache-headers')).toBe(true);
  });
});
