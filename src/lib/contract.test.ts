import { describe, it, expect } from 'vitest';
import { ALL_TOOLS, VISIBLE_TOOLS, getTool } from './registry';
import type { ToolMeta } from './types';

/**
 * Contract meta-test: invariants every visible tool's `meta` must satisfy for
 * its page to render correctly and rank well.
 *
 * It inspects meta objects only (no per-tool `import()` of implementations), so
 * it stays fast over ~400 tools. Each case reports *every* offending tool —
 * naming the tool id and the field — instead of stopping at the first failure.
 */

/** types.ts: "URL slug. Unique. kebab-case. Never changes once shipped." */
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** types.ts: `status?: 'stable' | 'beta'`. */
const ALLOWED_STATUS = ['stable', 'beta'];

/** types.ts: `summary` — "<= 120 chars". */
const MAX_SUMMARY = 120;

/** Editorial content lives in sibling `<id>.content.ts` modules, not on the meta. */
interface ArticleSection {
  heading: string;
  body: string;
}

const CONTENT_MODULES = import.meta.glob<{
  content: { article?: ArticleSection[]; faq?: { q: string; a: string }[] };
}>('../tools/**/*.content.ts', { eager: true });

const contentByTool = new Map<
  string,
  { article?: ArticleSection[]; faq?: { q: string; a: string }[] }
>();
for (const [path, mod] of Object.entries(CONTENT_MODULES)) {
  const id = (path.split('/').pop() ?? '').replace(/\.content\.ts$/, '');
  if (id) contentByTool.set(id, mod.content);
}

function articleOf(meta: ToolMeta): ArticleSection[] | undefined {
  return contentByTool.get(meta.id)?.article;
}

function faqOf(meta: ToolMeta): { q: string; a: string }[] | undefined {
  return contentByTool.get(meta.id)?.faq;
}

function articleWords(sections: ArticleSection[]): number {
  return sections
    .map((s) => s.body)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Base names of every `<id>.meta.ts`, so an id can be checked against its file. */
const metaFileBasenames = new Set(
  Object.keys(import.meta.glob('../tools/**/*.meta.ts')).map((path) =>
    (path.split('/').pop() ?? '').replace(/\.meta\.ts$/, ''),
  ),
);

describe('tool meta contract', { timeout: 30_000 }, () => {
  it('every tool id is kebab-case and matches its .meta.ts file name', () => {
    const problems: string[] = [];
    for (const { meta } of ALL_TOOLS) {
      if (!KEBAB_CASE.test(meta.id)) {
        problems.push(`${meta.id}: id is not kebab-case`);
      }
      if (!metaFileBasenames.has(meta.id)) {
        problems.push(`${meta.id}: no matching ${meta.id}.meta.ts file`);
      }
    }
    for (const base of metaFileBasenames) {
      if (!ALL_TOOLS.some((t) => t.meta.id === base)) {
        problems.push(`${base}: meta file has no registered tool`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('name and summary are non-empty and the summary fits 120 chars', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      if (!meta.name.trim()) problems.push(`${meta.id}: name is empty`);
      if (!meta.summary.trim()) {
        problems.push(`${meta.id}: summary is empty`);
      } else if (meta.summary.length > MAX_SUMMARY) {
        problems.push(`${meta.id}: summary is ${meta.summary.length} chars (max ${MAX_SUMMARY})`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('description is non-empty', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      if (!meta.description.trim()) problems.push(`${meta.id}: description is empty`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('has at least 3 runnable examples', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      // Examples are one-click text payloads. A file tool without the optional
      // textarea has no way to express one — its workbench starts from a real
      // file (often a live device capture), so the rule does not apply there.
      if (meta.input === 'file' && !meta.acceptsText) continue;
      const count = (meta.examples ?? []).length;
      if (count < 3) problems.push(`${meta.id}: examples has ${count} entries (min 3)`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('has at least 3 faq entries', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      const count = (faqOf(meta) ?? []).length;
      if (count < 3) problems.push(`${meta.id}: faq has ${count} entries (min 3)`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('article, when present, has 3–5 sections and is not thin', () => {
    const problems: string[] = [];
    // The gate exists to stop THIN pages (which search engines penalise and
    // assistants cannot quote). The editorial target is 150-300 words; the
    // upper bound is deliberately loose so genuinely longer, still-unique
    // prose is not churned just to satisfy a number.
    const MIN_WORDS = 150;
    const MAX_WORDS = 450;
    for (const { meta } of VISIBLE_TOOLS) {
      const article = articleOf(meta);
      if (!article) continue;
      if (article.length < 3 || article.length > 5) {
        problems.push(`${meta.id}: article has ${article.length} sections (expected 3–5)`);
      }
      const words = articleWords(article);
      if (words < MIN_WORDS || words > MAX_WORDS) {
        problems.push(
          `${meta.id}: article bodies total ${words} words (expected ${MIN_WORDS}–${MAX_WORDS})`,
        );
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it("privacy.processing is 'on-device'", () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      const processing: string = meta.privacy.processing;
      if (processing !== 'on-device') {
        problems.push(`${meta.id}: privacy.processing is "${processing}" (expected 'on-device')`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('status, when set, is stable or beta', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      const status: string | undefined = meta.status;
      if (status !== undefined && !ALLOWED_STATUS.includes(status)) {
        problems.push(`${meta.id}: status "${status}" is not one of ${ALLOWED_STATUS.join('|')}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('related ids all resolve to visible tools', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      for (const id of meta.related ?? []) {
        const target = getTool(id);
        if (!target) problems.push(`${meta.id}: related "${id}" does not exist`);
        else if (target.meta.hidden) problems.push(`${meta.id}: related "${id}" is not visible`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('option keys are unique within a tool', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      const seen = new Set<string>();
      for (const opt of meta.options ?? []) {
        if (seen.has(opt.key)) problems.push(`${meta.id}: duplicate option key "${opt.key}"`);
        seen.add(opt.key);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('a select option default is one of its choices', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      for (const opt of meta.options ?? []) {
        if (!('choices' in opt)) continue;
        const values = opt.choices.map((choice) => choice.value);
        if (!values.includes(opt.default)) {
          problems.push(
            `${meta.id}: option "${opt.key}" default "${opt.default}" is not in choices ` +
              `[${values.join(', ')}]`,
          );
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every showWhen.key names an existing option', () => {
    const problems: string[] = [];
    for (const { meta } of VISIBLE_TOOLS) {
      const options = meta.options ?? [];
      const keys = new Set(options.map((opt) => opt.key));
      for (const opt of options) {
        const target = opt.showWhen?.key;
        if (target !== undefined && !keys.has(target)) {
          problems.push(`${meta.id}: option "${opt.key}" showWhen.key "${target}" does not exist`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
