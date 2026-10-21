/**
 * The tool contract. Every tool in `src/tools/**` conforms to this.
 *
 * A tool is TWO co-located files:
 *   - `<id>.meta.ts`  — exports `meta: ToolMeta` (tiny; eagerly loaded for cards, search, SEO, routing)
 *   - `<id>.tool.ts`  — imports that meta, exports `default: ToolModule` (lazily loaded only when the tool runs)
 *
 * Nothing here touches the DOM or Node APIs, so `run()` is unit-testable in isolation
 * and portable to a Web Worker.
 */

export const CATEGORY_IDS = [
  'encoding',
  'crypto',
  'security',
  'text',
  'data',
  'developer',
  'web',
  'color',
  'datetime',
  'numbers',
  'converters',
  'generators',
  'network',
  'image',
  'pdf',
  'archive',
  'audio',
  'video',
  'device',
  'misc',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  name: string;
  /** One line, shown on the category card and header. */
  blurb: string;
  /** Icon id from `src/components/Icon.astro`. */
  icon: string;
  order: number;
}

/* -------------------------------------------------------------------------- */
/*  Option schema — rendered by the shared workbench into an accessible form  */
/* -------------------------------------------------------------------------- */

interface OptionCommon {
  key: string;
  label: string;
  help?: string;
  /** Hide unless another option has a given value: `{ key: 'mode', value: 'custom' }`. */
  showWhen?: { key: string; value: string | number | boolean };
}

export type ToolOption =
  | (OptionCommon & {
      type: 'select';
      default: string;
      choices: { value: string; label: string }[];
    })
  | (OptionCommon & { type: 'boolean'; default: boolean })
  | (OptionCommon & {
      type: 'number';
      default: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (OptionCommon & {
      type: 'range';
      default: number;
      min: number;
      max: number;
      step?: number;
    })
  | (OptionCommon & { type: 'text'; default: string; placeholder?: string })
  | (OptionCommon & { type: 'textarea'; default: string; placeholder?: string });

export type OptionValues = Record<string, string | number | boolean>;

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                  */
/* -------------------------------------------------------------------------- */

export interface ToolPrivacy {
  /** Always 'on-device' for shipped tools. */
  processing: 'on-device';
  /**
   * Runtime network calls the tool makes. `'none'` is asserted by an e2e test
   * that fails the build if the tool page issues any cross-origin request.
   */
  network: 'none' | string[];
  /** Works with no connection once the app is cached. */
  offline: boolean;
}

export interface ToolCredit {
  name: string;
  url: string;
  license: string;
}

export interface ToolMeta {
  /** URL slug. Unique. kebab-case. Never changes once shipped. */
  id: string;
  name: string;
  category: CategoryId;
  /** <= 120 chars. Used on cards and as the meta description fallback. */
  summary: string;
  /** 1–3 sentences shown at the top of the tool page. */
  description: string;
  /** Search + SEO keywords. */
  keywords: string[];
  privacy: ToolPrivacy;
  /** How the tool takes input. Drives which workbench renders. */
  input: 'text' | 'file';
  /** File `accept` attribute when `input: 'file'`. */
  accept?: string;
  /** Allow selecting multiple files. */
  multiple?: boolean;
  /**
   * This file tool also accepts text typed into the workbench. The shared file
   * workbench renders an extra textarea for such tools and passes the value
   * to `run()` as `input.text`. Only meaningful for `input: 'file'`.
   */
  acceptsText?: boolean;
  /**
   * Render the live camera panel above the workbench. Used by scanning tools
   * that can capture from `getUserMedia` as well as accept files.
   */
  camera?: boolean;
  /**
   * Use a dedicated workbench instead of the generic file/text workbench.
   * `'signature'` renders the signing panel: choose a PDF, capture a signature
   * (draw / type / upload), preview the page and place the mark. It is a flow
   * the generic option form cannot express.
   *
   * Any other value names a panel component in `src/components/panels/<id>.astro`
   * (the panel id is usually the tool id). The panel replaces the generic
   * workbench and is loaded lazily, one chunk per panel. A panel id with no
   * matching component fails the build, so a typo never ships an empty page.
   */
  panel?: 'signature' | (string & {});
  options?: ToolOption[];
  /** Runnable examples — one click fills the workbench. */
  examples?: { title: string; input?: string; options?: OptionValues }[];
  faq?: { q: string; a: string }[];
  /** Related tool ids. */
  related?: string[];
  /** Third-party code bundled for this tool (shown on the page + in NOTICE). */
  credits?: ToolCredit[];
  status?: 'stable' | 'beta';
  /** Force execution in a Web Worker (default: text→main thread, file→worker). */
  worker?: boolean;
  /** Hidden from listings but still routable. */
  hidden?: boolean;
  /**
   * Alias: this tool id is kept routable for backwards compatibility but its
   * page redirects to another tool id (e.g. a merged replacement). Set together
   * with `hidden: true` so the alias stays out of listings, search and counts.
   * Must name a real, non-alias tool id.
   */
  redirectTo?: string;
  /** ISO date, updated when behaviour changes. */
  updated?: string;
}

/* -------------------------------------------------------------------------- */
/*  Execution                                                                 */
/* -------------------------------------------------------------------------- */

export interface RunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

export interface TextRunInput extends RunContext {
  text: string;
  options: OptionValues;
}

/**
 * How the shared workbench should present `output`. All variants are XSS-safe.
 * `'audio'` — `output` is a `data:`/`blob:` audio URL → shown in `<audio controls>`, downloadable.
 */
export type OutputRender =
  | 'text' // plain, in a <textarea>/<pre>
  | 'code' // monospace block, optional language label
  | 'image' // `output` is a data: URL → shown in <img>, downloadable
  | 'colors' // `output` is JSON `string[]` of CSS colors → swatches
  | 'table' // `output` is JSON `{ headers: string[], rows: string[][] }`
  | 'diff' // `output` is a unified diff → colorised, read-only
  | 'audio' // `output` is a data:/blob: audio URL → <audio controls> + download
  | 'html-escaped'; // `output` shown literally (never parsed as HTML)

export interface TextRunResult {
  output: string;
  render?: OutputRender;
  /** Language hint for `render: 'code'` (e.g. 'json', 'yaml'). */
  language?: string;
  /** Suggested download filename if the user saves the output. */
  filename?: string;
  notes?: string[];
  warnings?: string[];
  /** Small key/value facts shown under the output. */
  stats?: Record<string, string | number>;
}

export interface FileRunInput extends RunContext {
  files: File[];
  options: OptionValues;
  /**
   * Text typed into the workbench. Only sent by tools that declare
   * `meta.acceptsText`; empty or absent when the user typed nothing.
   */
  text?: string;
}

export interface OutputFile {
  filename: string;
  blob: Blob;
  /** Optional preview data URL (images). */
  previewUrl?: string;
}

export interface FileRunResult {
  /**
   * Files produced by the tool. May be empty when `report` is set (a
   * report-only result — e.g. metadata/inspection tools that only show a table).
   */
  outputs: OutputFile[];
  /** Optional inline result shown in the workbench (not a download). */
  report?: { output: string; render?: OutputRender; language?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
}

export interface TextToolModule {
  meta: ToolMeta;
  run(input: TextRunInput): TextRunResult | Promise<TextRunResult>;
}

export interface FileToolModule {
  meta: ToolMeta;
  run(input: FileRunInput): Promise<FileRunResult>;
}

export type ToolModule = TextToolModule | FileToolModule;

/** Thrown by `run()` for expected, user-facing failures (bad input, unsupported format). */
export class ToolError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = 'ToolError';
    this.hint = hint;
  }
}

/* -------------------------------------------------------------------------- */
/*  Registry view models                                                      */
/* -------------------------------------------------------------------------- */

export interface RegisteredTool {
  meta: ToolMeta;
  /** Lazy loader for the implementation module. */
  load: () => Promise<{ default: ToolModule }>;
}
