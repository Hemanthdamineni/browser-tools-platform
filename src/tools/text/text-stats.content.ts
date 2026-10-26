/**
 * Editorial content for the text-stats tool page.
 *
 * Kept out of ``text-stats.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The counts, and what they count',
      body: 'Characters are counted as Unicode code points with spaces included, and a separate row strips every whitespace character, tabs and newlines too. Words are whitespace-separated tokens, sentences split on runs of ., ! and ?, and paragraphs are separated by blank lines. Lines are reported as well, which is why a poem or a list reads differently from prose with the same word count.',
    },
    {
      heading: 'Reading and speaking time',
      body: 'Reading time divides the word count by 238 words per minute, a common figure for adult silent reading, and speaking time uses 130, closer to a measured presentation pace. Both are rounded to the nearest second and are estimates: dense technical text takes longer than the number suggests, while a light listicle is quicker.',
    },
    {
      heading: 'Checking against platform limits',
      body: 'The character count shown at the top is compared against the limits of X/Twitter, LinkedIn, Instagram, meta descriptions and SMS. Each row shows the count, the limit and whether you are under it, exactly at it or over it. Meta descriptions are judged against the usual 155 to 160 character band, and an SMS segment is set at 160 characters.',
    },
    {
      heading: 'Readability scores, and privacy',
      body: 'Six scores are computed: Flesch Reading Ease, Flesch-Kincaid grade, Gunning Fog, SMOG, the Automated Readability Index and Coleman-Liau. All of them lean on syllable counts estimated from vowel groups, with a final silent "e" dropped and a floor of one syllable per word, so unusual spellings can shift a score by a point or two. Every count is computed locally as you type, with nothing sent anywhere.',
    },
  ],
  faq: [
    {
      q: 'How is reading time calculated?',
      a: 'Word count divided by 238 words per minute — a common estimate of adult silent reading speed — rounded to the nearest second. Speaking time uses 130 words per minute.',
    },
    {
      q: 'How are the platform limits counted?',
      a: 'The same character count shown at the top (Unicode code points, spaces included) is compared with each limit. Each row shows the count, the limit, and whether you are under it, exactly at it, or over it. Meta descriptions are checked against the usual 155–160 character band, and SMS against 160 characters per segment.',
    },
    {
      q: 'How accurate are the readability scores?',
      a: 'They are estimates. Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, ARI and Coleman-Liau all depend on syllable counts, which are estimated from vowel groups rather than a pronunciation dictionary, so proper nouns and unusual words can shift a score by a point or two. Treat them as a guide for comparing drafts, not as a verdict.',
    },
    {
      q: 'How are syllables and sentences counted?',
      a: 'Syllables use a vowel-group heuristic: every run of vowels (a, e, i, o, u, y) is one syllable, then a final silent "e" is dropped, with a floor of one syllable per word. Sentences are split on runs of . ! and ? characters, and for the readability formulas only sentences containing at least one word made of letters are counted.',
    },
    {
      q: 'What does "characters (no spaces)" mean?',
      a: 'The character count after removing every whitespace character, including tabs and newlines.',
    },
  ],
} as const;
