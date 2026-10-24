/**
 * The HTML playground.
 *
 * The UI lives in the dedicated `html-playground` panel (three source panes,
 * a sandboxed live preview and a Download button). The panel renders the
 * preview and builds the download itself with the pure helpers in
 * `html-playground-panel.ts` — this `run()` is the standalone path that powers
 * the registry contract: give it the three parts as JSON text and it returns
 * the same self-contained `.html` document the panel would download.
 *
 * The document is assembled by `buildDocument`: HTML into `<body>`, CSS into
 * `<style>`, JS into `<script>` with their closing tags neutralised so the
 * user's code cannot break out of the template. The result references nothing
 * off-page, so it runs anywhere on its own.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-playground.meta';
import { buildDocument, exportFileName, parseParts } from '../../components/panels/html-playground-panel';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text ?? '';
  if (!text.trim()) {
    return { output: '', filename: exportFileName(o) };
  }

  const parts = parseParts(text);
  if (!parts) {
    throw new ToolError(
      'The input is not a playground document.',
      'Paste JSON with html, css and js string fields — or use the playground panel to author one.',
    );
  }

  const document = buildDocument(parts);
  return {
    output: document,
    render: 'code',
    language: 'html',
    filename: exportFileName(o),
    stats: {
      html: parts.html.length,
      css: parts.css.length,
      js: parts.js.length,
      total: document.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;