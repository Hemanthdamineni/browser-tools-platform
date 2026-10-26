/**
 * Editorial content for the words-to-number tool page.
 *
 * Kept out of ``words-to-number.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Spelled-out numbers become digits',
      body: 'Type a number in English words and read back its value. The parser knows the ones and teens, the tens with their hyphens, hundred, and the scale words thousand, million, billion and trillion, so “two hundred thirty-four” returns 234 and “one million” returns 1000000.',
    },
    {
      heading: 'Decimals, sign and filler words',
      body: 'A “point” followed by digit words builds the fraction, making “three point one four” into 3.14, and a leading “negative” or “minus” flips the sign. The words “and” and “a” are treated as filler while any other word is skipped, so “the value is one million” still gives 1000000.',
    },
    {
      heading: 'What the grouping switch changes',
      body: 'Show with thousands separators controls the display alone. Left on, 1000000 is written as 1,000,000; turned off, you get the plain digits. The parsed value is the same either way, and the stats panel always shows the raw number for copying.',
    },
    {
      heading: 'Where the parser gives up',
      body: 'Bare digits mixed into the text are skipped, so write “five” rather than 5. If no number word appears at all the tool raises an error instead of quietly returning zero, and inputs over ten thousand characters or values beyond about a quadrillion are refused rather than guessed.',
    },
    {
      heading: 'Hard-coded tables, no upload',
      body: 'The word lists are compiled into the page and the parse is a single pass over your text in the browser. Nothing you type is sent anywhere and the tool runs without a network connection.',
    },
  ],
  faq: [
    {
      q: 'What number formats are supported?',
      a: 'Whole words from zero to trillions, hundreds, tens with hyphens, “and”, decimal points and negative/mimus. Consecutive digit words such as “one two three” become 123.',
    },
    {
      q: 'Are unrelated words ignored?',
      a: 'Yes — non-number words are skipped. “The total is five thousand” gives 5000. If the input contains no number words at all you get a clear error.',
    },
    {
      q: 'How big can it go?',
      a: 'Up to trillions (1e12). Values larger than about a quadrillion are rejected with an error rather than guessed.',
    },
  ],
} as const;
