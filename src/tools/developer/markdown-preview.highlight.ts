/**
 * Syntax highlighting for the Markdown preview.
 *
 * Shiki (MIT) is a runtime dependency of the preview, but it must never be
 * part of the initial page load: the whole module is only imported when the
 * panel asks for it, and even then Shiki itself is pulled in with dynamic
 * `import()` calls that Vite turns into separate chunks. Only the core, the
 * JavaScript regex engine, the chosen theme and the languages that actually
 * appear in the document are ever downloaded.
 *
 * The JavaScript regex engine is used on purpose: it needs no WebAssembly, so
 * the preview never downloads a `.wasm` file.
 *
 * Everything that can be decided without Shiki — which languages exist, how a
 * fence hint maps onto one of them, which theme to use — is a pure function in
 * this module, so it can be unit tested without loading the highlighter.
 */

/* -------------------------------------------------------------------------- */
/*  Languages                                                                    */
/* -------------------------------------------------------------------------- */

/** The languages the preview can highlight, mapped to their Shiki id. */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  python3: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  shellscript: 'bash',
  yml: 'yaml',
  md: 'markdown',
  mdown: 'markdown',
  htm: 'html',
  scss: 'scss',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  txt: 'text',
  plaintext: 'text',
};

/**
 * The Shiki languages this preview knows how to load. Every entry becomes its
 * own chunk, downloaded the first time a fence uses that language.
 *
 * `text` is not in the list: plain text is a language the Shiki core knows
 * without a grammar, so it needs no chunk at all.
 */
export const SUPPORTED_LANGUAGES = [
  'bash',
  'css',
  'diff',
  'dockerfile',
  'html',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'python',
  'scss',
  'sql',
  'tsx',
  'typescript',
  'xml',
  'yaml',
] as const;

export type LanguageName = (typeof SUPPORTED_LANGUAGES)[number];

/** Plain text: handled by the Shiki core, no grammar chunk needed. */
export const PLAIN_TEXT = 'text';

const LANGUAGE_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGUAGES);

/**
 * Map a fence hint onto a supported language, or `null` when the language is
 * not one this preview can highlight (the caller then falls back to a plain
 * `<pre><code>`).
 */
export function normalizeLanguage(language: string): LanguageName | typeof PLAIN_TEXT | null {
  const raw = (language ?? '').trim().toLowerCase();
  if (!raw) return null;
  const alias = LANGUAGE_ALIASES[raw];
  const candidate = alias ?? raw;
  if (candidate === PLAIN_TEXT) return PLAIN_TEXT;
  return LANGUAGE_SET.has(candidate) ? (candidate as LanguageName) : null;
}

/* -------------------------------------------------------------------------- */
/*  Themes                                                                       */
/* -------------------------------------------------------------------------- */

export const SUPPORTED_THEMES = ['github-light', 'github-dark', 'nord', 'dracula'] as const;

export type ThemeName = (typeof SUPPORTED_THEMES)[number];

/** The theme choice offered in the options form. */
export const THEME_CHOICES = [
  { value: 'auto', label: 'Match the page theme' },
  { value: 'github-light', label: 'GitHub Light' },
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'nord', label: 'Nord' },
  { value: 'dracula', label: 'Dracula' },
] as const;

/** Resolve the `auto` choice against the page theme; anything else is used as-is. */
export function resolveTheme(choice: string, pageTheme: 'light' | 'dark'): ThemeName {
  if (choice === 'auto') return pageTheme === 'dark' ? 'github-dark' : 'github-light';
  const name = (choice ?? '').trim().toLowerCase();
  return (SUPPORTED_THEMES as readonly string[]).includes(name)
    ? (name as ThemeName)
    : 'github-light';
}

/* -------------------------------------------------------------------------- */
/*  Lazy loading                                                                 */
/* -------------------------------------------------------------------------- */

type ThemeModule = { default: unknown };
type LanguageModule = { default: unknown[] };

/** Each theme is its own chunk — only the chosen one is ever downloaded. */
function importTheme(theme: ThemeName): Promise<ThemeModule> {
  switch (theme) {
    case 'github-dark':
      return import('shiki/themes/github-dark.mjs');
    case 'nord':
      return import('shiki/themes/nord.mjs');
    case 'dracula':
      return import('shiki/themes/dracula.mjs');
    case 'github-light':
    default:
      return import('shiki/themes/github-light.mjs');
  }
}

/** Each language is its own chunk — only the ones in the document are fetched. */
function importLanguage(language: LanguageName): Promise<LanguageModule> {
  switch (language) {
    case 'bash':
      return import('shiki/langs/bash.mjs');
    case 'css':
      return import('shiki/langs/css.mjs');
    case 'diff':
      return import('shiki/langs/diff.mjs');
    case 'dockerfile':
      return import('shiki/langs/dockerfile.mjs');
    case 'html':
      return import('shiki/langs/html.mjs');
    case 'javascript':
      return import('shiki/langs/javascript.mjs');
    case 'json':
      return import('shiki/langs/json.mjs');
    case 'jsx':
      return import('shiki/langs/jsx.mjs');
    case 'markdown':
      return import('shiki/langs/markdown.mjs');
    case 'python':
      return import('shiki/langs/python.mjs');
    case 'scss':
      return import('shiki/langs/scss.mjs');
    case 'sql':
      return import('shiki/langs/sql.mjs');
    case 'tsx':
      return import('shiki/langs/tsx.mjs');
    case 'typescript':
      return import('shiki/langs/typescript.mjs');
    case 'xml':
      return import('shiki/langs/xml.mjs');
    case 'yaml':
      return import('shiki/langs/yaml.mjs');
    default:
      return Promise.reject(new Error(`Unsupported language: ${language}`));
  }
}

/** The subset of Shiki's highlighter this preview uses. */
interface ShikiHighlighter {
  codeToHtml(code: string, options: { lang: string; theme: string }): string;
  getLoadedLanguages(): string[];
  loadLanguage(language: unknown): void;
}

export interface CodeHighlighter {
  /**
   * Make sure a language is loaded. The grammar is a separate chunk, so this
   * is the only asynchronous part of the highlighter.
   */
  prepare(language: string): Promise<void>;
  /**
   * Highlight one block of code. Returns `null` when the language is not
   * supported or the highlighter failed — the caller then falls back to a
   * plain `<pre><code>`.
   */
  highlight(code: string, language: string): string | null;
}

const highlighterCache = new Map<ThemeName, Promise<CodeHighlighter | null>>();

/**
 * Load Shiki for one theme. The returned promise is cached, so the heavy
 * chunks are downloaded once. A failure is not fatal: `null` means "no
 * highlighting", and the caller renders plain code blocks instead.
 */
export function loadHighlighter(theme: ThemeName): Promise<CodeHighlighter | null> {
  const cached = highlighterCache.get(theme);
  if (cached) return cached;

  const promise = createHighlighter(theme).catch(() => null);
  highlighterCache.set(theme, promise);
  return promise;
}

async function createHighlighter(theme: ThemeName): Promise<CodeHighlighter> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, themeModule] =
    await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      importTheme(theme),
    ]);

  const highlighter = (await createHighlighterCore({
    themes: [themeModule.default as never],
    langs: [],
    // The JavaScript regex engine — no WebAssembly download.
    engine: createJavaScriptRegexEngine(),
  })) as unknown as ShikiHighlighter;

  return {
    async prepare(language: string): Promise<void> {
      const name = normalizeLanguage(language);
      if (!name || name === PLAIN_TEXT) return;
      if (highlighter.getLoadedLanguages().includes(name)) return;
      const languageModule = await importLanguage(name as LanguageName);
      highlighter.loadLanguage(languageModule.default);
    },
    highlight(code: string, language: string): string | null {
      const name = normalizeLanguage(language);
      if (!name) return null;
      try {
        return highlighter.codeToHtml(code, { lang: name, theme });
      } catch {
        return null;
      }
    },
  };
}
