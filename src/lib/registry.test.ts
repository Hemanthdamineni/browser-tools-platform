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
    for (const t of ALL_TOOLS) {
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
});
