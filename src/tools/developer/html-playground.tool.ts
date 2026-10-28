import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { meta } from './html-playground.meta';
import { renderPlayground, createPreviewContainer } from './html-playground.core';

export async function run(input: TextRunInput): Promise<TextRunResult> {
  const code = input.text?.trim() || '';

  if (!code) {
    return {
      output: '<!-- Paste HTML, CSS or JavaScript above to see live preview. -->',
      render: 'code',
      language: 'html',
      stats: { bytes: 0, characters: 0 },
    };
  }

  // For playground, we treat input as the HTML source and render it
  const result = renderPlayground(code, '', '');

  return {
    output: result.previewHtml || code,
    render: 'code',
    language: 'html',
    filename: 'playground.html',
    stats: {
      bytes: new TextEncoder().encode(result.previewHtml || code).length,
      characters: result.previewHtml?.length || code.length,
    },
    errors: result.errors,
  };
}

const tool: TextToolModule = {
  meta,
  run,
};

export default tool;
