import { describe, it, expect } from 'vitest';
import {
  ALL_TOOLS,
  VISIBLE_TOOLS,
  ALIAS_TOOLS,
  getTool,
  redirectTarget,
  SEARCH_INDEX,
  categoriesWithCounts,
} from './registry';
import { CATEGORIES } from './categories';

describe('registry', () => {
  it('discovers at least the reference tools', () => {
    expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(4);
    expect(getTool('base64')).toBeTruthy();
  });

  it('every tool has a unique, kebab-case id', () => {
    const ids = ALL_TOOLS.map((t) => t.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('every tool has a known category', () => {
    ALL_TOOLS.forEach((t) => expect(t.meta.category in CATEGORIES).toBe(true));
  });

  it('every tool declares an on-device privacy model', () => {
    ALL_TOOLS.forEach((t) => {
      expect(t.meta.privacy.processing).toBe('on-device');
      expect(t.meta.summary.length).toBeLessThanOrEqual(120);
    });
  });

  it('related ids resolve to real tools', () => {
    ALL_TOOLS.forEach((t) => {
      for (const rel of t.meta.related ?? []) {
        // A related id may not exist yet during incremental development, but if it
        // resolves it must be a real tool object.
        const found = getTool(rel);
        if (found) expect(found.meta.id).toBe(rel);
      }
    });
  });

  it('search index covers every visible tool', () => {
    expect(SEARCH_INDEX.length).toBe(VISIBLE_TOOLS.length);
  });

  it('category counts only include non-empty categories', () => {
    categoriesWithCounts().forEach((c) => expect(c.count).toBeGreaterThan(0));
  });

  it('each tool module loads and exposes run()', async () => {
    // Redirect aliases have no implementation of their own — they redirect to a
    // replacement before any load — so they are excluded from the load sweep.
    const runnable = ALL_TOOLS.filter((t) => !t.meta.redirectTo);
    expect(runnable.length).toBeGreaterThan(0);
    for (const t of runnable) {
      const mod = await t.load();
      expect(typeof mod.default.run).toBe('function');
      expect(mod.default.meta.id).toBe(t.meta.id);
    }
  }, 120_000); // Lazily transforming every tool module is slow on constrained machines.
});

describe('registry aliases', () => {
  const legacyIds = [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-methods-headers',
    'access-control-expose-headers',
    'access-control-max-age',
  ];

  it('keeps every legacy access-control id routable as a hidden redirect', () => {
    for (const id of legacyIds) {
      const tool = getTool(id);
      expect(tool, `${id} should still resolve`).toBeTruthy();
      expect(tool?.meta.hidden).toBe(true);
      expect(tool?.meta.redirectTo).toBe('cors-headers');
      expect(redirectTarget(tool!.meta)?.meta.id).toBe('cors-headers');
    }
  });

  const conditionalIds = [
    'etag',
    'last-modified',
    'if-match',
    'if-none-match',
    'if-range',
    'if-modified-since',
    'if-unmodified-since',
  ];

  it('keeps every merged conditional id routable as a hidden redirect', () => {
    expect(getTool('conditional-request-headers')?.meta.hidden).not.toBe(true);
    for (const id of conditionalIds) {
      const tool = getTool(id);
      expect(tool, `${id} should still resolve`).toBeTruthy();
      expect(tool?.meta.hidden).toBe(true);
      expect(tool?.meta.redirectTo).toBe('conditional-request-headers');
      expect(redirectTarget(tool!.meta)?.meta.id).toBe('conditional-request-headers');
    }
  });

  it('keeps the merged escape ids routable as hidden redirects to string-escape', () => {
    for (const id of ['backslash-escape', 'json-escape', 'unicode-escape']) {
      const tool = getTool(id);
      expect(tool, `${id} should still resolve`).toBeTruthy();
      expect(tool?.meta.hidden).toBe(true);
      expect(tool?.meta.redirectTo).toBe('string-escape');
      expect(redirectTarget(tool!.meta)?.meta.id).toBe('string-escape');
    }
  });

  const analyzerIds = [
    'accept-ch',
    'alt-svc',
    'alt-used',
    'allow-header',
    'connection-header',
    'content-digest',
    'critical-ch',
    'date-header',
    'early-data',
    'expect-header',
    'forwarded-header',
    'link-header',
    'network-error-logging',
    'origin-header',
    'prefer-header',
    'priority-header',
    'reporting-endpoints',
    'retry-after',
    'server-timing',
    'signature-input',
    'speculation-rules',
    'sunset-deprecation',
    'timing-allow-origin',
    'traceparent',
    'tracestate',
    'trailer-header',
    'upgrade-header',
    'via-header',
    'warning-header',
    'x-robots-tag',
  ];

  it('keeps every merged long-tail header id routable as a hidden redirect', () => {
    expect(getTool('http-header-analyzer')?.meta.hidden).not.toBe(true);
    for (const id of analyzerIds) {
      const tool = getTool(id);
      expect(tool, `${id} should still resolve`).toBeTruthy();
      expect(tool?.meta.hidden).toBe(true);
      expect(tool?.meta.redirectTo).toBe('http-header-analyzer');
      expect(redirectTarget(tool!.meta)?.meta.id).toBe('http-header-analyzer');
    }
  });

  it('never points a related list at one of the folded header aliases', () => {
    for (const tool of VISIBLE_TOOLS) {
      for (const rel of tool.meta.related ?? []) {
        if (!analyzerIds.includes(rel)) continue;
        expect(tool.meta.hidden, `${tool.meta.id} should not be a visible alias`).not.toBe(true);
      }
    }
  });

  it('points every alias at a real, non-alias, visible tool', () => {
    expect(ALIAS_TOOLS.length).toBeGreaterThanOrEqual(legacyIds.length);
    for (const alias of ALIAS_TOOLS) {
      const target = alias.meta.redirectTo ? getTool(alias.meta.redirectTo) : undefined;
      expect(target, `${alias.meta.id} target must exist`).toBeTruthy();
      expect(target?.meta.id).toBe(alias.meta.redirectTo);
      expect(target?.meta.redirectTo).toBeUndefined();
      expect(target?.meta.hidden).not.toBe(true);
    }
  });

  it('excludes aliases from visible tools, search and counts', () => {
    for (const alias of ALIAS_TOOLS) {
      expect(VISIBLE_TOOLS.some((t) => t.meta.id === alias.meta.id)).toBe(false);
      expect(SEARCH_INDEX.some((entry) => entry.id === alias.meta.id)).toBe(false);
    }
    expect(SEARCH_INDEX.length).toBe(VISIBLE_TOOLS.length);
    expect(categoriesWithCounts().reduce((sum, c) => sum + c.count, 0)).toBe(VISIBLE_TOOLS.length);
  });

  it('only returns a redirect target for alias tools', () => {
    expect(redirectTarget(getTool('cors-headers')!.meta)).toBeUndefined();
    expect(redirectTarget(getTool('access-control-allow-origin')!.meta)?.meta.id).toBe(
      'cors-headers',
    );
  });

  it('keeps any alias tool file a thin delegate to its redirect target', () => {
    // An alias needs only its meta — `build()` no longer demands a `.tool.ts` and
    // `load()` is never reached. If one still ships a module, that module must
    // delegate to the merge target rather than carry a dead standalone
    // implementation (which would emit an unreachable lazy chunk).
    const toolSources = import.meta.glob('../tools/**/*.tool.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    for (const alias of ALIAS_TOOLS) {
      const target = alias.meta.redirectTo!;
      const match = Object.entries(toolSources).find(([path]) =>
        path.endsWith(`/${alias.meta.id}.tool.ts`),
      );
      if (!match) continue; // meta-only alias: exactly what we want.
      const [path, source] = match;
      const delegates = new RegExp(`['"][^'"]*${target}\\.(?:tool|core)['"]`).test(source);
      expect(
        delegates,
        `${path} must delegate to "${target}" — remove the dead implementation or point it at the target`,
      ).toBe(true);
    }
  });
});
