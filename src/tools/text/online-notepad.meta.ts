import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'online-notepad',
  name: 'Online Notepad',
  category: 'text',
  summary:
    'Keep multiple notes in your browser, autosaved on-device and exportable as .txt or .md.',
  description:
    'Write and keep several notes at once. Each one is autosaved to this browser’s IndexedDB as you type, so your draft survives a reload, and nothing ever leaves your device. Rename, delete or export any note as a .txt or .md file whenever you like.',
  keywords: [
    'notepad',
    'notes',
    'note taking',
    'text editor',
    'scratchpad',
    'memo',
    'autosave',
    'draft',
    'indexeddb',
    'offline notes',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'online-notepad',
  options: [
    {
      key: 'format',
      label: 'Export format',
      type: 'select',
      default: 'txt',
      choices: [
        { value: 'txt', label: 'Plain text (.txt)' },
        { value: 'md', label: 'Markdown (.md)' },
      ],
      help: 'How the exported note is written to the file.',
    },
    {
      key: 'title',
      label: 'Note title',
      type: 'text',
      default: 'note',
      help: 'Used for the export file name and the Markdown heading.',
    },
  ],
  examples: [
    { title: 'Export as .txt', input: 'hello world', options: { format: 'txt' } },
    { title: 'Export as .md', input: '**bold**', options: { format: 'md', title: 'My note' } },
    { title: 'A longer draft', input: 'First line\nSecond line' },
  ],
  faq: [
    {
      q: 'Where are my notes stored?',
      a: 'In this browser’s IndexedDB — the same private storage the browser uses for other web-app data. Notes never leave this browser and are not sent to any server.',
    },
    {
      q: 'How do I delete all my notes?',
      a: 'Use the “Delete all notes” button in the note list. It wipes every note from this browser. To remove them at the browser level too, clear the site’s data in your browser’s storage settings.',
    },
    {
      q: 'Will I lose my last edit if I close the tab?',
      a: 'No. Edits are autosaved as you type, and the latest text is flushed to storage the moment the tab is hidden or closed, so the very last keystroke is kept.',
    },
  ],
  related: ['text-stats', 'word-frequency', 'markdown-toc', 'char-frequency'],
  status: 'stable',
};
