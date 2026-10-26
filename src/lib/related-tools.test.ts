import { describe, it, expect } from 'vitest';
import { VISIBLE_TOOLS, getTool } from './registry';

/**
 * `relatedTools()` in `src/lib/registry.ts` resolves each id in `meta.related`
 * through `getTool()` and silently drops anything that is missing or hidden,
 * then back-fills the list from the same category. A dangling id or a folded
 * alias therefore degrades the page invisibly instead of failing.
 *
 * These tests fail loudly instead: every id a visible tool advertises must
 * resolve to a visible tool, and must appear at most once.
 */
describe('related tools contract', () => {
  it('lists only existing, visible related ids', () => {
    const problems: string[] = [];
    for (const tool of VISIBLE_TOOLS) {
      for (const id of tool.meta.related ?? []) {
        const target = getTool(id);
        if (!target) {
          problems.push(`${tool.meta.id}: related "${id}" does not exist`);
        } else if (target.meta.hidden) {
          problems.push(`${tool.meta.id}: related "${id}" is hidden (an alias)`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('never repeats a related id within one tool', () => {
    const problems: string[] = [];
    for (const tool of VISIBLE_TOOLS) {
      const seen = new Set<string>();
      for (const id of tool.meta.related ?? []) {
        if (seen.has(id)) problems.push(`${tool.meta.id}: related "${id}" is listed twice`);
        seen.add(id);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
