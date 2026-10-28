import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'online-notepad',
  name: 'Online Notepad',
  category: 'text',
  summary: 'Auto-saving notepad with multiple notes and IndexedDB persistence. Export to .txt or .md.',
  description:
    'A distraction-free notepad that auto-saves to your browser\'s IndexedDB. Create, edit, and organize multiple notes with a sidebar. Export any note as .txt or .md. All data stays on your device — no server, no sync, no account needed. The panel provides a full editor experience with live word/character counts.',
  keywords: [
    'online notepad',
    'notes app',
    'markdown editor',
    'auto save notes',
    'indexeddb notes',
    'local notes',
    'export notes',
    'text editor',
    'markdown notes',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'online-notepad',
  options: [
    {
      key: 'defaultFormat',
      label: 'Default export format',
      type: 'select',
      default: 'md',
      choices: [
        { value: 'md', label: 'Markdown (.md)' },
        { value: 'txt', label: 'Plain Text (.txt)' },
      ],
    },
  ],
  examples: [
    { title: 'Start a new note', options: {} },
  ],
  faq: [
    {
      q: 'Where are my notes stored?',
      a: 'In your browser\'s IndexedDB under the "online-notepad" database. They persist across browser sessions but are tied to this browser/profile. Clearing site data will delete them.',
    },
    {
      q: 'Can I access my notes on another device?',
      a: 'No — this tool does not sync. Export your notes as .md or .txt files and transfer them manually if needed.',
    },
    {
      q: 'Does it support Markdown formatting?',
      a: 'The editor is plain text with live word/character counts. You can write Markdown syntax and export as .md, but there is no live preview pane.',
    },
    {
      q: 'How many notes can I create?',
      a: 'Limited by your browser\'s IndexedDB quota (typically hundreds of MB). Each note stores its content, title, created/updated timestamps, and word count.',
    },
    {
      q: 'Can I recover a deleted note?',
      a: 'No — deletion is immediate and permanent. There is no trash/recycle bin. Export important notes regularly.',
    },
  ],
  related: ['text-stats', 'word-frequency', 'markdown-table-format', 'markdown-toc'],
  status: 'stable',
};