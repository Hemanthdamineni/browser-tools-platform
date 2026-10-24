/**
 * Tool registry — zero manual wiring.
 *
 * Drop a `<id>.meta.ts` + `<id>.tool.ts` pair anywhere under `src/tools/` and it
 * is picked up automatically:
 *   - `.meta.ts` modules are eagerly imported (they are tiny) so cards, search,
 *     SEO and `getStaticPaths()` work at build time.
 *   - `.tool.ts` modules are left as lazy import factories, so a tool's code (and
 *     any heavy dependency it pulls in) only downloads when someone runs it.
 */

import type { CategoryId, RegisteredTool, ToolMeta } from './types';
import { CATEGORIES, CATEGORY_LIST } from './categories';

const metaModules = import.meta.glob<{ meta: ToolMeta }>('../tools/**/*.meta.ts', {
  eager: true,
});
const toolModules = import.meta.glob('../tools/**/*.tool.ts');

function toolKey(path: string): string {
  return path.replace(/\.(meta|tool)\.ts$/, '');
}

function basename(path: string): string {
  return toolKey(path).split('/').pop() ?? '';
}

function build(): RegisteredTool[] {
  const loaders = new Map<string, () => Promise<{ default: never }>>();
  for (const [path, loader] of Object.entries(toolModules)) {
    loaders.set(toolKey(path), loader as () => Promise<{ default: never }>);
  }

  const tools: RegisteredTool[] = [];
  const seen = new Set<string>();

  for (const [path, mod] of Object.entries(metaModules)) {
    const meta = mod.meta;
    if (!meta) {
      throw new Error(`${path} does not export "meta"`);
    }
    const load = loaders.get(toolKey(path));
    // Redirect aliases (and hidden metas) have no implementation of their own —
    // the registry resolves them to a replacement before any load happens. A
    // normal, visible tool must still ship a real `.tool.ts` module.
    const isAlias = !!meta.redirectTo || !!meta.hidden;
    if (!load && !isAlias) {
      throw new Error(`${path} has no matching ".tool.ts" implementation`);
    }
    if (seen.has(meta.id)) {
      throw new Error(`Duplicate tool id "${meta.id}" (${path})`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.id)) {
      throw new Error(`Tool id "${meta.id}" must be kebab-case (${path})`);
    }
    if (basename(path) !== meta.id) {
      throw new Error(
        `File name must match tool id: ${path} exports id "${meta.id}" (expected "${meta.id}.meta.ts")`,
      );
    }
    if (!(meta.category in CATEGORIES)) {
      throw new Error(`Tool "${meta.id}" has unknown category "${meta.category}"`);
    }
    seen.add(meta.id);
    // Aliases never reach a loader — they redirect to a replacement before any
    // run happens — so a missing `.tool.ts` is fine. Give them a stub that fails
    // loudly rather than a silent undefined dereference if one is ever invoked.
    const loader =
      load ??
      (() =>
        Promise.reject(
          new Error(
            `Tool "${meta.id}" is a redirect alias to "${meta.redirectTo ?? 'a replacement'}" and has no runnable implementation`,
          ),
        ));
    tools.push({ meta, load: loader as RegisteredTool['load'] });
  }

  return tools.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
}

export const ALL_TOOLS: RegisteredTool[] = build();

// Alias wiring is validated once at build time so a mistyped target fails loudly
// instead of producing a dead page or a redirect loop.
for (const tool of ALL_TOOLS) {
  const target = tool.meta.redirectTo;
  if (!target) continue;
  if (!tool.meta.hidden) {
    throw new Error(`Alias tool "${tool.meta.id}" must set hidden: true`);
  }
  const resolved = ALL_TOOLS.find((t) => t.meta.id === target);
  if (!resolved) {
    throw new Error(`Tool "${tool.meta.id}" redirects to unknown tool "${target}"`);
  }
  if (resolved.meta.redirectTo) {
    throw new Error(`Tool "${tool.meta.id}" redirects to alias "${target}" (point at a real tool)`);
  }
}

/** Routable-but-hidden ids kept purely as redirects to a merged replacement. */
export const ALIAS_TOOLS = ALL_TOOLS.filter((t) => !!t.meta.redirectTo);

/** The visible replacement a redirect alias points at, if any. */
export function redirectTarget(meta: ToolMeta): RegisteredTool | undefined {
  return meta.redirectTo ? getTool(meta.redirectTo) : undefined;
}

export const VISIBLE_TOOLS = ALL_TOOLS.filter((t) => !t.meta.hidden);

export function getTool(id: string): RegisteredTool | undefined {
  return ALL_TOOLS.find((t) => t.meta.id === id);
}

export function toolsInCategory(category: CategoryId): RegisteredTool[] {
  return VISIBLE_TOOLS.filter((t) => t.meta.category === category);
}

export function categoriesWithCounts() {
  return CATEGORY_LIST.map((c) => ({
    ...c,
    count: toolsInCategory(c.id).length,
  })).filter((c) => c.count > 0);
}

export function relatedTools(meta: ToolMeta, limit = 4): RegisteredTool[] {
  const explicit = (meta.related ?? [])
    .map((id) => getTool(id))
    .filter((t): t is RegisteredTool => !!t && !t.meta.hidden);

  if (explicit.length >= limit) return explicit.slice(0, limit);

  const sameCategory = toolsInCategory(meta.category).filter(
    (t) => t.meta.id !== meta.id && !explicit.some((e) => e.meta.id === t.meta.id),
  );
  return [...explicit, ...sameCategory].slice(0, limit);
}

/** Compact index shipped to the client for instant search. */
export interface SearchEntry {
  id: string;
  name: string;
  summary: string;
  category: CategoryId;
  categoryName: string;
  keywords: string[];
  href: string;
}

export const SEARCH_INDEX: SearchEntry[] = VISIBLE_TOOLS.map((t) => ({
  id: t.meta.id,
  name: t.meta.name,
  summary: t.meta.summary,
  category: t.meta.category,
  categoryName: CATEGORIES[t.meta.category].name,
  keywords: t.meta.keywords,
  href: `/tools/${t.meta.id}`,
}));

export const TOOL_COUNT = VISIBLE_TOOLS.length;
export const CATEGORY_COUNT = categoriesWithCounts().length;
