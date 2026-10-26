/**
 * Editorial content for the editorconfig tool page.
 *
 * Kept out of ``editorconfig.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the generated file contains',
      body: 'The output starts with root = true, which tells editors to stop searching parent directories, then a [*] section that applies to every file: indent style, indent size, end of line, charset, trailing-whitespace trimming and final-newline insertion. Setting a maximum line length above zero adds a max_line_length line, and a final [*.md] section is appended.',
    },
    {
      heading: 'Indentation: spaces versus tabs',
      body: 'With spaces selected the file sets indent_style = space and indent_size = your chosen number (1 to 8). With tabs selected only indent_style = tab is written, because indent_size has no agreed meaning for tabs and editors interpret it differently \u2014 which is why the generator does not simply always emit both keys.',
    },
    {
      heading: 'Line endings, charset and whitespace',
      body: 'End of line is lf, the Unix and modern default, or crlf for Windows, and charset is utf-8 or latin1. Trailing-whitespace trimming and final-newline insertion are each a plain true or false, and those two settings together are the most common source of noisy diffs when a team disagrees about them.',
    },
    {
      heading: 'The Markdown override, and what to watch for',
      body: 'Markdown treats two trailing spaces as a hard line break, so a global trim rule would silently change rendering, which is why a [*.md] section always sets trim_trailing_whitespace = false. The file is assembled from your choices in this tab with nothing uploaded; note that .editorconfig needs editor or plugin support before the rules take effect.',
    },
  ],
  faq: [
    {
      q: 'Why the [*.md] override?',
      a: 'Markdown uses two trailing spaces as a hard line break, so trimming trailing whitespace in .md files would silently change rendering. The generator therefore always sets trim_trailing_whitespace = false for Markdown.',
    },
    {
      q: 'What does root = true mean?',
      a: 'It marks this file as the top of the configuration chain, so editors stop looking for another .editorconfig in parent directories. It is what you want in a repository root.',
    },
    {
      q: 'Why is indent_size missing when I pick tabs?',
      a: 'Editors disagree about what an indent_size means for tab characters, so the generator writes only indent_style = tab. If you need a tab width, set it in the editor or in a language-specific section instead.',
    },
  ],
} as const;
