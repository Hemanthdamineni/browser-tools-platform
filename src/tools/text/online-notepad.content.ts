/**
 * Editorial content for the online-notepad tool page.
 *
 * Kept out of ``online-notepad.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Several drafts, kept side by side',
      body: "Online Notepad holds a list of notes you can create, rename and delete, and each one autosaves to this browser's IndexedDB as you type, so a reload or a closed tab does not lose the last keystroke.",
    },
    {
      heading: 'Exporting a note in the shape you need',
      body: 'The export format option writes either plain text, which is the note content exactly as typed, or Markdown, which is the same text with a heading built from the title. The title supplies both that heading and the download file name, which is slugged to safe characters and falls back to note.',
    },
    {
      heading: 'Why keep notes in the browser',
      body: "It suits throwaway snippets, meeting scratch and anything you would not put in a shared document. Because storage lives in your browser's own private area, a note is available offline and disappears when you clear that site's data or press Delete all notes.",
    },
    {
      heading: 'Your words stay put',
      body: 'No note, title or keystroke is ever sent to a server; the whole editor and its storage run on your device, and nothing leaves it.',
    },
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
} as const;
