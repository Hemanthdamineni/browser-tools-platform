/**
 * Editorial content for the pdf-page-numbers tool page.
 *
 * Kept out of ``pdf-page-numbers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Stamping numbers onto the pages',
      body: 'Choose a PDF and the tool loads it with pdf-lib, embeds Helvetica and draws a label on each page. Position picks one of six corners, Format chooses between 1, 1 of 10, Page 1 and Page 1 of 10, and you get back numbered.pdf with stats for the page count and how many pages were stamped.',
    },
    {
      heading: 'Fixing a document you have to hand in',
      body: 'Reach for it before submitting a report, a contract or a court bundle, when a print-out is being assembled by hand, or when a slide deck has been exported to PDF for review. It is also the quick repair for a scan whose original numbering was lost.',
    },
    {
      heading: 'Options that set the label',
      body: 'Start at shifts the first number, so a document continuing an earlier volume can begin at 5. Font size (6–72, default 10) and Margin (0–200, default 24) control the label size and distance from the paper edge. Skip the first page leaves a cover clean and begins counting on the second page.',
    },
    {
      heading: 'Caveats',
      body: 'Labels use the standard Helvetica font. With Skip the first page on, the number drawn on page two is the Start at value, offset so the count reads naturally. Numbers sit inside the page box, so an unusual crop box or rotation can put a label somewhere unexpected. The source file is not modified.',
    },
    {
      heading: 'Numbering done locally',
      body: 'The PDF is parsed and rewritten in your browser with pdf-lib and the file is never uploaded. Contracts, payslips and internal reports can be numbered without leaving your machine, and it works offline.',
    },
  ],
  faq: [
    {
      q: 'Which label formats are available?',
      a: 'Plain numbers (1, 2, 3), the count form (3 of 12), a prefixed form (Page 3) and the full prefixed count (Page 3 of 12). The total always refers to the whole document, not to the remaining pages after the start offset.',
    },
    {
      q: 'What does "Skip the first page" do to the numbering?',
      a: 'The first page is left unnumbered and the labels begin on page two, offset by one so the count still reads naturally: with Skip on and Start at 1, page two is labelled 1. Leave it off to number the cover as page one.',
    },
    {
      q: 'Is the original PDF changed?',
      a: 'No. The tool reads the file you provide, draws the labels onto a copy held in memory and hands back a new numbered.pdf. Your original file is untouched.',
    },
  ],
} as const;
