/**
 * Editorial content for the readability-score tool page.
 *
 * Kept out of ``readability-score.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Two scores from one pass over the text',
      body: 'The tool counts the words, sentences and syllables in whatever you paste and plugs them into the two classic Flesch formulas. Flesch Reading Ease runs 0 to 100 with higher meaning easier to read and a plain-English range around 60–70. Flesch-Kincaid Grade Level reports the US school grade a reader would need — grade 8 means a 13 to 14 year old can manage it — and both are clamped to their usual bounds so a single very hard sentence cannot blow the scale. The result is a table of the two scores, the words per sentence, syllables per word, and a short interpretation of each.',
    },
    {
      heading: 'The math behind the numbers',
      body: 'Reading Ease is 206.835 minus 1.015 times words per sentence minus 84.6 times syllables per word, which rewards short sentences and short words. The Grade Level formula is 0.39 times words per sentence plus 11.8 times syllables per word minus 15.59, so a text full of long sentences and multi-syllable words lands at a high grade. Words per sentence and syllables per word are shown beside the scores because they are the two levers that move them, and the note tells you which way each lever points.',
    },
    {
      heading: 'How syllables are estimated',
      body: 'Syllables are counted without a dictionary: every run of vowels in a word counts as one syllable, then a rule drops the silent trailing e in words like like and have while never going below a single syllable. That keeps the count fast and needs no dictionary, but it is an estimate, so a proper noun or an unusual name can nudge the score a little. The words, sentences and syllables used in the formulas are shown as extra rows when the show-counts option is on, so you can see where a surprising score came from.',
    },
    {
      heading: 'When the score is not trustworthy',
      body: 'The formulas are built for prose, so a single word or a very short phrase can produce a number that does not generalise. For input under about a hundred words the note flags the result as indicative only, and text with no words at all is rejected with a hint. Input is capped at two hundred thousand characters and, like every other computation here, the whole analysis runs in your browser — the text you paste is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'What do the two scores mean?',
      a: "Flesch Reading Ease runs 0–100: roughly 90–100 is very easy (children's books), 60–70 is plain English, under 30 is very difficult. Flesch-Kincaid Grade Level reports the US education grade needed, so 8 means an average 13–14 year old can read it.",
    },
    {
      q: 'How are syllables counted?',
      a: 'By a vowel-group estimate — every run of vowels (a, e, i, o, u, y after a consonant) in a word counts as one syllable, then small rules fix silent-e endings. It is close for English without needing a dictionary.',
    },
    {
      q: 'When is short text unreliable?',
      a: 'The formulas are meant for prose like articles. A single word or a very short phrase can produce a score that does not generalise, so the result is marked as approximate for input under about 100 words.',
    },
  ],
} as const;
