import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { meta } from './mermaid-renderer.meta';
import { resolveOptions, renderMermaid } from './mermaid-renderer.core';

export type MermaidRunInput = TextRunInput & {
  options?: OptionValues;
  text?: string;
};

export async function run(input: MermaidRunInput): Promise<TextRunResult> {
  const o = resolveOptions(input.options ?? {});
  const source = input.text ?? '';

  if (!source.trim()) {
    throw new Error('No Mermaid source provided');
  }

  const { svg, png } = await renderMermaid(source, o);

  const result: TextRunResult = {
    output: svg,
    render: 'image',
    stats: {
      theme: o.theme,
      scale: o.scale,
    },
  };

  if (png) {
    result.outputs = [{ filename: 'diagram.png', blob: new Blob([png], { type: 'image/png' }) }];
  }

  return result;
}

const tool: TextToolModule = { meta, run };
export default tool;
