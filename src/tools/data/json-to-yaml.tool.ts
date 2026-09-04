import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { stringify } from 'yaml';
import { meta } from './json-to-yaml.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  let data: unknown;
  try {
    data = JSON.parse(input.text);
  } catch (e) {
    throw new ToolError('Invalid JSON input.', (e as Error).message);
  }

  const indent = o.indent === '4' ? 4 : 2;
  let output: string;
  try {
    output = stringify(data, { indent });
  } catch (e) {
    throw new ToolError('Could not convert this value to YAML.', (e as Error).message);
  }

  return {
    output,
    render: 'code',
    language: 'yaml',
    filename: 'data.yaml',
    stats: { 'output lines': output.replace(/\n$/, '').split('\n').length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
