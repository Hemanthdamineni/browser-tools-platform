/**
 * Editorial content for the indent-text tool page.
 *
 * Kept out of ``indent-text.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Shifting a block left or right',
      body: 'In indent mode every line is prefixed with the chosen number of spaces or tabs, which is what you want when pasting a snippet into a nested block. Dedent is the reverse: it strips up to the chosen amount of the same leading unit from the start of each line, so a block copied out of a function can be lifted back to column zero.',
    },
    {
      heading: 'Spaces or tabs',
      body: 'The unit selector decides the character that is added or removed. With spaces, the count is how many space characters prefix the level; with tabs, one unit is a single tab character and the count is how many tabs. Dedent only removes the selected unit, so a file that mixes both will stop at the first character that does not match.',
    },
    {
      heading: 'Blank lines can be skipped',
      body: 'With the blank-line option on, empty or whitespace-only lines are left exactly as they are instead of gaining trailing indentation, which keeps diffs clean. Turn it off when you need strictly uniform leading whitespace on every line, including the empty ones.',
    },
    {
      heading: 'Runs as you type',
      body: 'The transformation is a line-by-line string operation performed in this tab. Nothing is uploaded, no request is made, and there is no saved state, so pasting private source or configuration here exposes it to nobody but you.',
    },
  ],
  faq: [
    {
      q: 'What does dedent do if a line has less indentation than requested?',
      a: 'It removes whatever leading indentation is there, up to the requested amount, and leaves the rest of the line alone. It never removes non-whitespace characters.',
    },
    {
      q: 'Does dedent mix spaces and tabs?',
      a: 'No. It removes only the selected unit from the start of each line, stopping at the first character that is not that unit.',
    },
    {
      q: 'How are blank lines handled?',
      a: 'By default blank lines are left untouched in both modes. Turn "Leave blank lines untouched" off to indent or dedent them like any other line.',
    },
  ],
} as const;
