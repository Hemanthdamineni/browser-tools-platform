import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './code-to-image.meta';
import { resolveOptions } from '@/lib/options';
import {
  buildFilename,
  buildImageSvg,
  highlight,
  rasteriseSvg,
  resolveLanguage,
  type CodeToImageOptions,
  type ShikiLike,
} from './code-to-image.core';

export type CodeToImageRunInput = TextRunInput & {
  options?: OptionValues;
  text?: string;
};

let shikiPromise: Promise<ShikiLike> | undefined;

const THEME_IDS = [
  'github-dark',
  'github-light',
  'github-dark-dimmed',
  'one-dark-pro',
  'dracula',
  'nord',
  'catppuccin-mocha',
  'catppuccin-latte',
  'vitesse-dark',
  'vitesse-light',
  'tokyo-night',
  'rose-pine',
  'min-dark',
  'min-light',
] as const;

/**
 * Shiki (WASM grammars + themes) is several MB, so like Prettier in
 * `code-beautify` it is imported on first use and never at the top level —
 * static import would put it in the initial bundle for every tool page.
 */
async function loadShiki(): Promise<ShikiLike> {
  if (!shikiPromise) {
    shikiPromise = (async () => {
      const shiki = await import('shiki');
      const highlighter = await shiki.createHighlighter({
        themes: [...THEME_IDS],
        langs: Object.keys(shiki.bundledLanguages),
      });
      return highlighter as unknown as ShikiLike;
    })();
    shikiPromise.catch(() => {
      shikiPromise = undefined;
    });
  }
  return shikiPromise;
}

async function run(
  input: CodeToImageRunInput,
): Promise<TextRunResult & { outputs?: { filename: string; blob: Blob }[] }> {
  const o = resolveOptions(meta, input.options ?? {}) as unknown as CodeToImageOptions;
  const code = input.text ?? '';

  if (!code.trim()) {
    throw new ToolError(
      'Paste some code to turn into an image.',
      'Type or paste a snippet in the input box above.',
    );
  }

  const language = resolveLanguage(o.language, o.title, code);
  const shiki = await loadShiki();
  const highlighted = await highlight(shiki, code, language, o.theme);

  const { svg, width, height } = buildImageSvg(highlighted, {
    padding: o.padding,
    background: o.background,
    customBackground: o.customBackground,
    showChrome: o.showChrome,
    title: o.title,
  });

  const filename = buildFilename(o.filename, o.format);

  if (o.format === 'png') {
    const blob = await rasteriseSvg(svg, { width, height }, o.scale);
    const url = URL.createObjectURL(blob);
    return {
      output: url,
      render: 'image',
      filename,
      notes: [`PNG rasterised at ${o.scale}× via canvas, fully on-device.`],
      stats: {
        language,
        theme: o.theme,
        width: Math.round(width * o.scale),
        height: Math.round(height * o.scale),
        format: 'png',
      },
      outputs: [{ filename, blob }],
    };
  }

  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return {
    output: dataUrl,
    render: 'image',
    filename,
    notes: ['Vector SVG — sharp at any size.'],
    stats: { language, theme: o.theme, width, height, format: 'svg' },
    outputs: [{ filename, blob }],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
