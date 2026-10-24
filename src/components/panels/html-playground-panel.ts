/**
 * The HTML playground panel.
 *
 * Owns the three-pane editor (HTML / CSS / JS), the live preview and the
 * download. Everything worth testing lives in this module as a pure function
 * (`buildDocument`, `assembleExport`, `neutraliseClosingTag`, `debounce`,
 * `parseParts`); the mount at the bottom only wires those to the page.
 *
 * ## Security — the sandbox is the boundary
 *
 * The preview runs in an `<iframe>` whose `sandbox` attribute is exactly
 * `allow-scripts` and deliberately NOT `allow-same-origin`. Without
 * `allow-same-origin` the preview gets a unique, opaque origin: it can run
 * its own scripts and styles, but it can never reach this page's storage,
 * cookies or DOM, and it cannot resolve this site's origin at all. The user's
 * JavaScript is therefore NOT escaped — it is meant to execute — because the
 * sandbox, not escaping, is what contains it.
 *
 * The one framing hazard the template does handle is a closing `</script>`
 * (or `</style>`) sitting inside the user's code: a raw one would end the
 * wrapper element early and spill the rest of the code into the document as
 * markup. `neutraliseClosingTag` turns it into `<\/script` — the same
 * character to JavaScript, but no longer an HTML end tag.
 *
 * ## Export
 *
 * The downloaded `.html` is stitched by the very same `buildDocument`, so what
 * you preview is exactly what you save: one self-contained document that
 * references nothing off-page.
 */
import type { OptionValues } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { readOptions } from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  The document template                                                     */
/* -------------------------------------------------------------------------- */

/** The three source panes that make up a playground document. */
export interface PlaygroundParts {
  html: string;
  css: string;
  js: string;
}

/** The starter document the panes open with, and that Reset restores. */
export const DEFAULT_PARTS: PlaygroundParts = {
  html: [
    '<h1 id="greeting">Hello, world!</h1>',
    '<p>Edit the panes and watch the preview update as you type.</p>',
    '<button id="greet" type="button">Click me</button>',
  ].join('\n'),
  css: [
    'body {',
    '  font-family: system-ui, sans-serif;',
    '  max-width: 40rem;',
    '  margin: 2rem auto;',
    '  padding: 0 1rem;',
    '  color: #1f2937;',
    '}',
    'h1 { color: #2563eb; }',
    'button {',
    '  padding: 0.5rem 1rem;',
    '  border: 0;',
    '  border-radius: 0.375rem;',
    '  background: #2563eb;',
    '  color: #fff;',
    '  cursor: pointer;',
    '}',
  ].join('\n'),
  js: [
    'const button = document.querySelector("#greet");',
    'button.addEventListener("click", () => {',
    '  button.textContent = "You clicked the button.";',
    '});',
  ].join('\n'),
};

/**
 * Neutralise a closing tag inside user code so it cannot terminate the
 * `<style>` / `<script>` wrapper and spill out of the template. `<\/style`
 * and `<\/script` are still the same characters to CSS and JavaScript, but
 * they are no longer an HTML end tag.
 */
export function neutraliseClosingTag(code: string, tag: 'script' | 'style'): string {
  const closing = new RegExp(`</${tag}`, 'gi');
  return code.replace(closing, (match) => match.replace('<', '<\\'));
}

/** Parse a JSON payload of the three parts, as the panel and the tool use it. */
export function parseParts(text: string): PlaygroundParts | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { html, css, js } = parsed as Record<string, unknown>;
  return {
    html: typeof html === 'string' ? html : '',
    css: typeof css === 'string' ? css : '',
    js: typeof js === 'string' ? js : '',
  };
}

/**
 * Assemble the self-contained document the sandbox renders — and the user
 * downloads. The HTML goes into `<body>` verbatim so it renders; the CSS goes
 * into `<style>` and the JS into `<script>`, both with their closing tags
 * neutralised so neither can break out of the template. The template adds no
 * `<link>`, no remote font and no script reference, so the result works
 * standalone.
 */
export function buildDocument(parts: PlaygroundParts): string {
  const css = neutraliseClosingTag(parts.css ?? '', 'style');
  const js = neutraliseClosingTag(parts.js ?? '', 'script');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Playground preview</title>',
    '<style>',
    css,
    '</style>',
    '</head>',
    '<body>',
    parts.html ?? '',
    '<script>',
    js,
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/*  The download                                                              */
/* -------------------------------------------------------------------------- */

/** The download file name used when the `fileName` option is left empty. */
export const DEFAULT_EXPORT_NAME = 'playground.html';

/** The file name for the download, honouring the `fileName` option. */
export function exportFileName(options?: OptionValues): string {
  const name = String(options?.fileName ?? '').trim();
  if (!name) return DEFAULT_EXPORT_NAME;
  return name.endsWith('.html') ? name : `${name}.html`;
}

/**
 * Stitch the three parts into the one self-contained `.html` file the user
 * downloads. The payload is exactly `buildDocument`, so the saved file is the
 * document that was previewed.
 */
export function assembleExport(parts: PlaygroundParts, options?: OptionValues): Blob {
  return new Blob([buildDocument(parts)], { type: 'text/html;charset=utf-8' });
}

/* -------------------------------------------------------------------------- */
/*  Scheduling                                                                */
/* -------------------------------------------------------------------------- */

/** A debounced scheduler: collapses a burst of edits into one call. */
export interface Debounced<T extends unknown[]> {
  schedule: (...args: T) => void;
  /** Drop a pending call without running it. */
  cancel: () => void;
}

/**
 * Run `fn` at most once per `wait` ms, collapsing a burst of edits (a
 * keystroke a second) into a single re-render. The last scheduled call wins.
 * Exported so the preview's re-render cadence can be tested directly.
 */
export function debounce<T extends unknown[]>(fn: (...args: T) => void, wait: number): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (...args: T): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  };
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  return { schedule, cancel };
}

/** How long after the last keystroke the preview refreshes (ms). */
export const PREVIEW_DEBOUNCE_MS = 250;

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mount the playground panel into a `[data-html-playground-workbench]`
 * element: wire the three textareas to a debounced re-render into the
 * sandboxed iframe, and connect the example chips, Download and Reset.
 */
export function mountHtmlPlaygroundPanel(root: HTMLElement): void {
  const htmlInput = root.querySelector<HTMLTextAreaElement>('[data-pane="html"]')!;
  const cssInput = root.querySelector<HTMLTextAreaElement>('[data-pane="css"]')!;
  const jsInput = root.querySelector<HTMLTextAreaElement>('[data-pane="js"]')!;
  const preview = root.querySelector<HTMLIFrameElement>('[data-preview]')!;
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-download]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;

  /** The three source panes read as one `PlaygroundParts`. */
  function currentParts(): PlaygroundParts {
    return { html: htmlInput.value, css: cssInput.value, js: jsInput.value };
  }

  /** Render the current parts into the sandboxed iframe. */
  function render(): void {
    try {
      // `srcdoc` rebuilds the whole document, so the preview always reflects
      // exactly what is in the three panes.
      preview.srcdoc = buildDocument(currentParts());
      errorBox.hidden = true;
    } catch {
      errorBox.hidden = false;
      errorBox.textContent = 'The preview could not be rendered in this browser.';
    }
  }

  const rerender = debounce(render, PREVIEW_DEBOUNCE_MS);

  /** Load a set of parts into the three panes and refresh immediately. */
  function loadParts(parts: PlaygroundParts): void {
    rerender.cancel();
    htmlInput.value = parts.html;
    cssInput.value = parts.css;
    jsInput.value = parts.js;
    render();
  }

  for (const pane of [htmlInput, cssInput, jsInput]) {
    pane.addEventListener('input', () => rerender.schedule());
  }

  downloadBtn.addEventListener('click', () => {
    const options = readOptions(optionsRoot);
    downloadBlob(assembleExport(currentParts(), options), exportFileName(options));
  });

  resetBtn.addEventListener('click', () => loadParts(DEFAULT_PARTS));

  // The example chips each carry a JSON payload of the three parts.
  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      let payload: { input?: string } = {};
      try {
        payload = JSON.parse(button.dataset.examplePayload ?? '{}') as { input?: string };
      } catch {
        return;
      }
      const parts = parseParts(payload.input ?? '');
      if (parts) loadParts(parts);
    });
  });

  // Initial render so the preview is never blank (the panes may have been
  // pre-filled with the starter document server-side).
  render();
}