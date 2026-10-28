/**
 * Editorial content for the elf-binary-inspector tool page.
 *
 * Kept out of ``elf-binary-inspector.meta.ts`` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Is the binary executed or uploaded?',
      a: 'Neither. The file is read as bytes in your browser and only the ELF header tables are parsed. Nothing is run, and nothing leaves the device.',
    },
    {
      q: 'What does the hardening verdict mean?',
      a: 'It reports PIE, RELRO, non-executable stack and stack-protector evidence from the headers and symbols. Each result names the evidence it used, so a missing feature is explained rather than merely flagged.',
    },
    {
      q: 'Are symbol tables always present?',
      a: 'No. Stripped binaries keep dynamic symbols but drop the full symbol table, and some object types have none at all. The inspector reports what the file actually contains instead of guessing.',
    },
  ],
} as const;
