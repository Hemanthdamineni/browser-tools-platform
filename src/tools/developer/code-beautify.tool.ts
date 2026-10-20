import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './code-beautify.meta';

/* -------------------------------------------------------------------------- */
/*  Language table                                                            */
/* -------------------------------------------------------------------------- */

/** Every value the `language` option may hold. `auto` sniffs the input. */
const LANGUAGES = [
  'auto',
  'babel',
  'typescript',
  'css',
  'scss',
  'less',
  'json',
  'html',
  'vue',
  'markdown',
  'yaml',
] as const;
type Language = (typeof LANGUAGES)[number];
type ResolvedLanguage = Exclude<Language, 'auto'>;

/** A parser plugin bundle that can be downloaded on its own. */
type PluginKey = 'babel' | 'estree' | 'typescript' | 'postcss' | 'html' | 'markdown' | 'yaml';

interface LanguageSpec {
  parser: string;
  plugins: PluginKey[];
  /** Label shown on the result and used as the stats value. */
  label: string;
  /** Extension for the download filename. */
  extension: string;
}

/**
 * Which parser + printer plugins each language needs. Prettier's standalone
 * build ships no parsers, so a language only ever loads its own plugins.
 * Vue is the one exception: it embeds JavaScript, so it loads the html plugin
 * plus the JS parsers (and the TypeScript one when the script block is TS).
 */
const SPECS: Record<ResolvedLanguage, LanguageSpec> = {
  babel: { parser: 'babel', plugins: ['babel', 'estree'], label: 'javascript', extension: 'js' },
  typescript: {
    parser: 'typescript',
    plugins: ['typescript', 'estree'],
    label: 'typescript',
    extension: 'ts',
  },
  css: { parser: 'css', plugins: ['postcss'], label: 'css', extension: 'css' },
  scss: { parser: 'scss', plugins: ['postcss'], label: 'scss', extension: 'scss' },
  less: { parser: 'less', plugins: ['postcss'], label: 'less', extension: 'less' },
  json: { parser: 'json', plugins: ['babel', 'estree'], label: 'json', extension: 'json' },
  html: { parser: 'html', plugins: ['html'], label: 'html', extension: 'html' },
  vue: { parser: 'vue', plugins: ['html', 'babel', 'estree'], label: 'vue', extension: 'vue' },
  markdown: { parser: 'markdown', plugins: ['markdown'], label: 'markdown', extension: 'md' },
  yaml: { parser: 'yaml', plugins: ['yaml'], label: 'yaml', extension: 'yaml' },
};

/* -------------------------------------------------------------------------- */
/*  Lazy loading                                                              */
/* -------------------------------------------------------------------------- */

type PrettierModule = typeof import('prettier/standalone');
type PrettierPlugin = import('prettier').Plugin;

let standalone: Promise<PrettierModule> | null = null;

/** Prettier's standalone build, imported on first use and never at the top level. */
function loadPrettier(): Promise<PrettierModule> {
  standalone ??= import('prettier/standalone');
  return standalone;
}

const pluginCache = new Map<PluginKey, Promise<PrettierPlugin>>();

/**
 * One parser/printer bundle, imported on first use. The switch keeps the import
 * specifiers static so the bundler can split each plugin into its own chunk.
 */
function loadPlugin(key: PluginKey): Promise<PrettierPlugin> {
  let pending = pluginCache.get(key);
  if (!pending) {
    switch (key) {
      case 'babel':
        pending = import('prettier/plugins/babel') as Promise<PrettierPlugin>;
        break;
      case 'estree':
        pending = import('prettier/plugins/estree') as Promise<PrettierPlugin>;
        break;
      case 'typescript':
        pending = import('prettier/plugins/typescript') as Promise<PrettierPlugin>;
        break;
      case 'postcss':
        pending = import('prettier/plugins/postcss') as Promise<PrettierPlugin>;
        break;
      case 'html':
        pending = import('prettier/plugins/html') as Promise<PrettierPlugin>;
        break;
      case 'markdown':
        pending = import('prettier/plugins/markdown') as Promise<PrettierPlugin>;
        break;
      case 'yaml':
        pending = import('prettier/plugins/yaml') as Promise<PrettierPlugin>;
        break;
    }
    pluginCache.set(key, pending);
  }
  return pending;
}

/** Plugins for a language, plus TypeScript when a Vue script block asks for it. */
function pluginsFor(language: ResolvedLanguage, source: string): PluginKey[] {
  const base = SPECS[language].plugins;
  if (language === 'vue' && /\blang\s*=\s*["']tsx?["']/i.test(source)) {
    return [...base, 'typescript'];
  }
  return base;
}

/* -------------------------------------------------------------------------- */
/*  Language detection                                                        */
/* -------------------------------------------------------------------------- */

/** Tokens that mean "this is JavaScript/TypeScript", never a stylesheet. */
const JS_HINT =
  /\b(const|let|var|function|class|return|import|export|interface|type|enum|namespace|declare|implements|abstract|new|async|await|throw|typeof|instanceof)\b|=>/;

function looksLikeTypeScript(s: string): boolean {
  if (/\b(interface|enum|namespace|declare|implements|abstract)\s+[A-Za-z_$]/.test(s)) return true;
  if (/\btype\s+[A-Za-z_$]\w*\s*=/.test(s)) return true;
  if (/\b(?:const|let|var)\s+[A-Za-z_$]\w*\s*:\s*[A-Za-z_$[(]/.test(s)) return true;
  if (
    /\b(?:const|let|var|function)\b[^\n]*\)\s*:\s*(?:string|number|boolean|void|any|unknown|never|[A-Z]\w*)/.test(
      s,
    )
  )
    return true;
  if (/\([^()]*:\s*(?:string|number|boolean|void|any|unknown|never)[,)]/.test(s)) return true;
  if (/\bas\s+(?:const|unknown|never|string|number|boolean|[A-Z]\w*)\b/.test(s)) return true;
  return false;
}

function looksLikeJavaScript(s: string): boolean {
  return JS_HINT.test(s) || /(^|[^=!<>])=[^=]/.test(s) || /[;{}]\s*$/.test(s.trim());
}

function looksLikeStyles(s: string): boolean {
  return (
    /[{}]/.test(s) &&
    /(^|[\s{};])([A-Za-z-]+)\s*:\s*[^;{}]+/.test(s) &&
    !JS_HINT.test(s)
  );
}

function stylesLanguage(s: string): ResolvedLanguage {
  if (/^\s*\$[A-Za-z_][\w-]*\s*:/m.test(s)) return 'scss';
  if (/^\s*@[A-Za-z_][\w-]*\s*:[^;{}]*;/m.test(s)) return 'less';
  if (/@(mixin|include|extend|use|forward|at-root|function)\b/.test(s)) return 'scss';
  if (/&:extend|(^|[;{]\s*)\.([\w-]+)\s*\(/.test(s)) return 'less';
  return 'css';
}

function looksLikeMarkdown(s: string): boolean {
  return (
    /(^|\n)[ \t]{0,3}#{1,6}\s+\S/.test(s) ||
    /```/.test(s) ||
    /\*\*[^*\n]+\*\*/.test(s) ||
    /\[[^\]\n]+\]\([^)\n]+\)/.test(s) ||
    /(^|\n)[ \t]{0,3}(?:[-*+]|\d+\.)\s+\S/.test(s)
  );
}

function looksLikeYaml(s: string): boolean {
  return /^[ \t]*[A-Za-z_][\w .-]*:[ \t]*(?:$|\S)/m.test(s) && !/[{}]/.test(s);
}

function sniffLanguage(text: string): ResolvedLanguage {
  const s = text.trim();

  // Vue single-file component: a <template> block with a script or style block.
  if (/<template[\s>]/i.test(s) && /<(script|style)[\s>]/i.test(s)) return 'vue';

  // JSON — the only case where "does it parse?" is a definitive answer.
  if (/^[{[]/.test(s)) {
    try {
      JSON.parse(s);
      return 'json';
    } catch {
      /* not JSON; keep sniffing */
    }
  }

  if (/^<!doctype\s+html/i.test(s) || /<html[\s>]/i.test(s)) return 'html';

  if (looksLikeStyles(s)) return stylesLanguage(s);

  if (looksLikeTypeScript(s)) return 'typescript';
  if (looksLikeJavaScript(s)) return 'babel';

  if (looksLikeYaml(s)) return 'yaml';
  if (looksLikeMarkdown(s)) return 'markdown';

  throw new ToolError(
    'Could not tell which language this is.',
    'Choose one under Options, for example JavaScript, TypeScript, CSS, HTML, JSON, Markdown or YAML.',
  );
}

function resolveLanguage(selected: string, text: string): ResolvedLanguage {
  if (selected !== 'auto' && (LANGUAGES as readonly string[]).includes(selected)) {
    return selected as ResolvedLanguage;
  }
  return sniffLanguage(text);
}

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function trailingComma(value: unknown): 'all' | 'es5' | 'none' {
  return value === 'es5' || value === 'none' ? value : 'all';
}

/* -------------------------------------------------------------------------- */
/*  Run                                                                       */
/* -------------------------------------------------------------------------- */

/** Prettier's message, reduced to its first meaningful line. */
function firstLine(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const line = raw.split('\n').find((part) => part.trim() !== '');
  return (line ?? raw).trim() || 'Could not format this input.';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o: OptionValues = resolveOptions(meta, input.options);
  const text = input.text ?? '';
  if (text.trim() === '') return { output: '' };

  const language = resolveLanguage(String(o.language), text);
  const spec = SPECS[language];

  input.onProgress?.(0, 'Loading formatter…');
  const prettier = await loadPrettier();
  const plugins = await Promise.all(pluginsFor(language, text).map(loadPlugin));
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.5, 'Formatting…');

  let output: string;
  try {
    output = await prettier.format(text, {
      parser: spec.parser,
      plugins,
      printWidth: toNumber(o.printWidth, 80, 20, 200),
      tabWidth: toNumber(o.tabWidth, 2, 1, 8),
      semi: Boolean(o.semi),
      singleQuote: Boolean(o.singleQuote),
      trailingComma: trailingComma(o.trailingComma),
    });
  } catch (err) {
    throw new ToolError(
      firstLine(err),
      'Check for a syntax error near the position above, or pick a different language under Options.',
    );
  }

  // Count logical lines: a trailing newline is a terminator, not an extra line.
  const lines = output === '' ? 0 : output.replace(/\n$/, '').split('\n').length;

  return {
    output,
    render: 'code',
    language: spec.label,
    filename: `formatted.${spec.extension}`,
    stats: { language: spec.label, lines, characters: output.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
