/**
 * Code to Image — the standalone registry entry point.
 *
 * The interactive side lives in the dedicated `code-to-image` panel: the panel
 * module (`src/components/panels/code-to-image-panel.ts`) owns the pure
 * measure/layout/SVG maths and the lazily loaded Shiki highlighter, and the
 * panel component (`code-to-image.astro`) wires the DOM. This `run()` is the
 * pure path that powers the tool contract: it resolves and clamps the option
 * form with the panel's `resolveSettings`, highlights the snippet through the
 * shared highlighter, lays it out and serialises the self-contained SVG the
 * panel previews and downloads.
 *
 * Shiki itself only loads in the browser — `getHighlighter` dynamically imports
 * the core, the Oniguruma WebAssembly engine and the grammars/themes from this
 * origin, so a page that never highlights ships none of it. Tests never touch
 * it either: `renderFromHighlight` is the seam that takes an already-produced
 * token stream (real from Shiki, faked from a test) and does everything else.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  buildSvg,
  getHighlighter,
  imageColorsFor,
  layout,
  layoutOptionsOf,
  resolveSettings,
  type CodeImageSettings,
  type TokenLineLike,
} from '@/components/panels/code-to-image-panel';
import { meta } from './code-to-image.meta';

/* -------------------------------------------------------------------------- */
/*  Grammar + theme loaders (each its own chunk, fetched on first use)        */
/* -------------------------------------------------------------------------- */

/**
 * The languages that ship a Shiki grammar in this install. The `plaintext`
 * choice maps onto the grammar-free `text` language the Shiki core knows, so
 * it needs no entry here.
 */
const GRAMMARS = {
  bash: () => import('shiki/langs/bash.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
} as const;

type GrammarLanguage = keyof typeof GRAMMARS;

/** The Shiki themes offered in the option form, each its own chunk. */
const THEMES = {
  'github-dark': () => import('shiki/themes/github-dark.mjs'),
  'github-light': () => import('shiki/themes/github-light.mjs'),
  'one-dark-pro': () => import('shiki/themes/one-dark-pro.mjs'),
  'one-light': () => import('shiki/themes/one-light.mjs'),
  nord: () => import('shiki/themes/nord.mjs'),
  dracula: () => import('shiki/themes/dracula.mjs'),
  'solarized-dark': () => import('shiki/themes/solarized-dark.mjs'),
  'solarized-light': () => import('shiki/themes/solarized-light.mjs'),
  'tokyo-night': () => import('shiki/themes/tokyo-night.mjs'),
  monokai: () => import('shiki/themes/monokai.mjs'),
  'min-dark': () => import('shiki/themes/min-dark.mjs'),
  'min-light': () => import('shiki/themes/min-light.mjs'),
} as const;

/* -------------------------------------------------------------------------- */
/*  Auto-detection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Guess the language of a snippet from its first lines. The option form offers
 * "Auto-detect", and Shiki has no detector of its own, so this matches the
 * small set of unambiguous markers the supported languages carry. Anything it
 * cannot place falls back to the grammar-free plain text.
 */
export function guessLanguage(code: string): string {
  const head = code.slice(0, 4000);

  if (/^\s*<\?php/.test(head)) return 'php';
  if (/^#!.*\bpython/.test(head)) return 'python';
  if (/^\s*<!DOCTYPE\s+html/i.test(head) || /<html[\s>]/i.test(head)) return 'html';
  // A quoted key inside a leading object/array is JSON, not JavaScript.
  if (/^\s*[{[]/.test(head) && /"[\w.-]+"\s*:/.test(head)) return 'json';
  if (/^---\s*$/.test(head.trimEnd().split('\n')[0] ?? '') && /^[\w-]+\s*:/m.test(head))
    return 'yaml';
  if (/<\/(?:div|span|p|body|head|section|ul|table|a|h1)\b/i.test(head)) return 'html';
  if (/^\s*def\s+\w+\s*\([^)]*\)\s*:/m.test(head)) return 'python';
  if (/^\s*(?:import|from)\s+\w+\s*$/m.test(head)) return 'python';
  if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*(?:string|number|boolean|any|void)\b/.test(head))
    return 'typescript';
  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b/.test(head)) return 'rust';
  if (/\b(?:function|const|let)\b|=>/.test(head)) return 'javascript';
  if (/\bSELECT\b[\s\S]*\bFROM\b|\bCREATE\s+TABLE\b/i.test(head)) return 'sql';
  if (/^#!.*\b(?:ba|z)?sh\b/m.test(head) || /^\$\s+\w+/m.test(head)) return 'bash';
  if (/^#!.*\bruby\b/.test(head)) return 'ruby';
  if (/#include\s*<\w+\.h>/.test(head)) return 'c';
  if (/#include\s*<(?:iostream|vector|string|map)>/.test(head) || /\bstd::/.test(head))
    return 'cpp';
  if (/\bpublic\s+(?:class|static\s+void\s+main)\b/.test(head)) return 'java';
  if (/\busing\s+System\b/.test(head) || /\bnamespace\s+\w+/.test(head)) return 'csharp';
  if (/\bpackage\s+\w+\s*;?\s*$/.test(head) || /\bfunc\s+\w+\s*\(/.test(head)) return 'go';
  if (/\bputs\b|\battr_(?:accessor|reader)\b|\brequire\s+'[\w/]+'/.test(head)) return 'ruby';
  if (/^#{1,6}\s+\S/m.test(head)) return 'markdown';
  if (/(?:^|\n)\s*[.#]?[\w-]+\s*\{[^{}]*[;:][^{}]*\}/.test(head)) return 'css';
  return 'text';
}

/* -------------------------------------------------------------------------- */
/*  The highlight seam                                                        */
/* -------------------------------------------------------------------------- */

/** A highlight Shiki already produced (or a test fake shaped the same way). */
export interface HighlightResult {
  /** One token line per logical line of code. */
  tokens: TokenLineLike[];
  /** The theme's default foreground. */
  fg: string;
  /** The theme's default background. */
  bg: string;
  /** The concrete language the tokens were produced with (never `auto`). */
  lang: string;
}

/** Base64-encode an (possibly non-ASCII) SVG string as an `image/svg+xml` URI. */
function svgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Turn a highlight into the finished tool result: colours, layout, SVG
 * serialisation and the `data:` URL the workbench shows as an image.
 *
 * Pure — this is the seam tests use instead of Shiki. The SVG the workbench
 * shows is always the vector (the shared renderer offers a rasterised PNG
 * download for it on the spot), and `format` selects which download the panel
 * steers the user towards.
 */
export function renderFromHighlight(
  _text: string,
  settings: CodeImageSettings,
  highlighted: HighlightResult,
): TextRunResult {
  const colors = imageColorsFor(settings, { fg: highlighted.fg, bg: highlighted.bg });
  const opts = layoutOptionsOf(settings);
  const laid = layout(highlighted.tokens, opts);
  const svg = buildSvg(laid, colors, opts, settings.chrome ? settings.title : '');

  return {
    output: svgDataUri(svg),
    render: 'image',
    filename: 'code-snippet.svg',
    notes:
      settings.format === 'png'
        ? ['The PNG download rasterises this SVG at 2× in your browser.']
        : undefined,
    stats: {
      language: highlighted.lang,
      size: `${laid.imageWidth} × ${laid.imageHeight} px`,
      lines: laid.lineCount,
      format: settings.format,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Shiki (browser only)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Highlight `code` for `settings`: load the theme and the grammar the settings
 * name (auto-detected first when the option is `auto`), then tokenise. This is
 * the only async, Shiki-dependent step — everything after it is pure.
 */
export async function highlight(
  code: string,
  settings: CodeImageSettings,
): Promise<HighlightResult> {
  const lang = settings.language === 'auto' ? guessLanguage(code) : settings.language;
  const grammar = lang === 'plaintext' ? 'text' : lang;
  if (grammar !== 'text' && !(grammar in GRAMMARS)) {
    throw new ToolError(`"${lang}" is not a supported language.`, 'Pick one from the list.');
  }
  const themeLoader = THEMES[settings.theme as keyof typeof THEMES];
  if (!themeLoader) {
    throw new ToolError(`"${settings.theme}" is not a supported theme.`, 'Pick one from the list.');
  }

  const highlighter = await getHighlighter();
  await highlighter.loadTheme((await themeLoader()).default);
  if (grammar !== 'text') {
    const grammarLoader = GRAMMARS[grammar as GrammarLanguage];
    await highlighter.loadLanguage((await grammarLoader()).default);
  }
  const highlighted = highlighter.codeToTokens(code, { lang: grammar, theme: settings.theme });
  return { tokens: highlighted.tokens, fg: highlighted.fg, bg: highlighted.bg, lang: grammar };
}

/* -------------------------------------------------------------------------- */
/*  Tool entry point                                                          */
/* -------------------------------------------------------------------------- */

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.text?.trim()) return { output: '' };

  const settings = resolveSettings(o);
  const highlighted = await highlight(input.text, settings);
  return renderFromHighlight(input.text, settings, highlighted);
}

const tool: TextToolModule = { meta, run };
export default tool;
