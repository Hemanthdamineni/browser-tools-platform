import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'remove-empty-lines',
  name: 'Remove Empty Lines',
  category: 'text',
  summary:
    'Strip blank and whitespace-only lines, collapse blank runs to one, or trim trailing blanks.',
  description:
    'Clean up spacing in a block of text. Drop every empty or whitespace-only line, collapse runs of blank lines down to a single separator, or just remove blank lines hanging off the end.',
  keywords: [
    'remove empty lines',
    'delete blank lines',
    'strip blank lines',
    'collapse blank lines',
    'trim trailing lines',
    'whitespace',
    'clean text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'remove-all',
      choices: [
        { value: 'remove-all', label: 'Remove all blank lines' },
        { value: 'collapse', label: 'Collapse runs to one blank line' },
        { value: 'trim-trailing', label: 'Trim trailing blank lines only' },
      ],
    },
  ],
  article: [
    {
      heading: 'What counts as a blank line',
      body: 'The cleaner works on newline-separated text and treats any line holding nothing but spaces, tabs or other whitespace as blank. In “Remove all blank lines” each such line is deleted and the survivors are joined back with single newlines; the stats report exactly how many lines went. This is the mode for pasted spreadsheet columns, CSV exports and transcript dumps, where a stray empty row breaks the structure. Lines are split on plain newlines, so a Windows file keeps its carriage returns on the lines that survive.',
    },
    {
      heading: 'Collapsing runs instead of deleting them',
      body: 'When paragraph boundaries carry meaning, “Collapse runs to one blank line” keeps a single separator wherever two or more blank lines appeared — including a run at the very start of the text — so the rhythm survives while triple-spaced documents still shrink.',
    },
    {
      heading: 'Trimming just the tail',
      body: '“Trim trailing blank lines” strips blank lines hanging off the end and touches nothing in the body, leaving files that already have deliberate internal spacing exactly as they were.',
    },
    {
      heading: 'Edge cases and where the text goes',
      body: 'Empty input returns empty output rather than an error, and lines the tool keeps are copied verbatim with their indentation intact. The whole transformation happens in your browser; the text you paste is never transmitted, logged or stored.',
    },
  ],
  examples: [
    {
      title: 'Remove every blank line',
      input: 'one\n\n\ntwo\n   \nthree\n',
      options: { mode: 'remove-all' },
    },
    {
      title: 'Collapse double blanks',
      input: 'one\n\n\n\ntwo\n\n\nthree',
      options: { mode: 'collapse' },
    },
    {
      title: 'Trim trailing blanks',
      input: 'one\ntwo\n\n\n',
      options: { mode: 'trim-trailing' },
    },
  ],
  faq: [
    {
      q: 'Does a line with only spaces or tabs count as blank?',
      a: 'Yes. In every mode a line is "blank" when it contains nothing but whitespace.',
    },
    {
      q: 'What does collapse do to leading blank lines?',
      a: 'Any run of consecutive blank lines anywhere in the text — including at the start — is reduced to a single blank line.',
    },
    {
      q: 'Does it rewrite the lines it keeps?',
      a: 'No. Surviving lines are copied exactly as they arrived, keeping their indentation and any trailing carriage returns from a Windows file. Only whole blank lines are dropped, collapsed or trimmed, depending on the mode.',
    },
  ],
  related: ['dedupe-lines', 'line-numbers', 'sort-lines', 'find-replace'],
  status: 'stable',
};
