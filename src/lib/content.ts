/**
 * Editorial content for a tool page.
 *
 * Split out of `ToolMeta` (as `<id>.content.ts` siblings) so the eager client
 * registry never ships long-form prose: these modules are imported only by
 * pages and SEO endpoints, which run at build time. The client bundle keeps
 * only the lean meta — id, options, examples — while every tool page still
 * carries unique article + FAQ content for readers and answer engines.
 */
export interface ToolContent {
  /**
   * Long-form prose shown on the tool page as a "How it works" section, placed
   * between the workbench and the FAQ. Each entry is one `heading` and one
   * plain-text `body` paragraph — never HTML; both are escaped when rendered.
   * Optional: tools without it keep the generic explainer copy. The headings
   * also become the steps of the page's `HowTo` structured data.
   */
  article?: { heading: string; body: string }[];
  faq?: { q: string; a: string }[];
}

const contentModules = import.meta.glob<{ content: ToolContent }>('../tools/**/*.content.ts', {
  eager: true,
});

/** tool id → editorial content (build-time only; never imported client-side). */
export const ALL_CONTENT = new Map<string, ToolContent>();
for (const [path, mod] of Object.entries(contentModules)) {
  const id = path.split('/').pop()?.replace('.content.ts', '');
  if (id) ALL_CONTENT.set(id, mod.content);
}

/** Editorial content for a tool id, or undefined when the tool has none. */
export function getContent(id: string): ToolContent | undefined {
  return ALL_CONTENT.get(id);
}
