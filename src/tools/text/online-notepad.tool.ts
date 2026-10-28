import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './online-notepad.meta';

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);

  // The actual notepad UI is in the panel. This tool run provides info.
  return {
    output:
      'Online Notepad\n' +
      '==============\n\n' +
      'This tool uses a dedicated panel for the full notepad experience.\n' +
      'Open the panel to create, edit, and manage multiple notes with:\n\n' +
      '- Auto-save to IndexedDB (persists across sessions)\n' +
      '- Multiple notes with sidebar navigation\n' +
      '- Live word/character count\n' +
      '- Export as .txt or .md\n' +
      '- All data stays in your browser\n\n' +
      'Notes are stored locally in IndexedDB under the "online-notepad" database.\n' +
      'No data leaves your device. No sync, no account required.\n\n' +
      'Use the panel for the full editing experience.',
    render: 'text',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;