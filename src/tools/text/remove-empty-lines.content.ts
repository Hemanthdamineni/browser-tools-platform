/**
 * Editorial content for the remove-empty-lines tool page.
 *
 * Kept out of ``remove-empty-lines.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
