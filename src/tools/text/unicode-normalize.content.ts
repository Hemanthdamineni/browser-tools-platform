/**
 * Editorial content for the unicode-normalize tool page.
 *
 * Kept out of ``unicode-normalize.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What normalization actually changes',
      body: 'Unicode lets the same visible text be encoded more than one way, so two strings that look identical can compare as unequal and fail a unique index. Normalizing rewrites the code points into a canonical order without changing what the reader sees. NFC composes a base character and its marks into the fewest code points and is the usual choice for storage; NFD does the opposite, splitting a letter like é into e plus a combining accent, which is what you want when a system needs to strip or process the marks separately.',
    },
    {
      heading: 'Canonical versus compatibility forms',
      body: 'The NFKC and NFKD forms go further than their canonical counterparts: as well as reordering, they fold compatibility characters onto their plain equivalents, so a circled digit becomes an ordinary digit and a full-width Latin letter becomes a normal one. That is exactly right when you are comparing identifiers or search terms, but it discards a distinction the original text made, so it is not safe to apply blindly to content where those characters are meaningful. The chosen form is reported in the stats alongside the input and output lengths.',
    },
    {
      heading: 'Stripping accents and fixing line endings',
      body: 'The remove-combining-marks option answers the common "fold an accented name to ASCII letters" requirement. It decomposes the text first — using NFKD when the chosen form is a compatibility one, NFD otherwise — and then deletes every combining mark, so accented letters keep their base letter and lose the decoration. The line-ending option is independent of normalization: it rewrites whatever mixture of CRLF, CR and LF the input contains into the one style you pick, or leaves it exactly as it arrived.',
    },
    {
      heading: 'Where it runs',
      body: 'The work is a single pass over the string using the browser’s own normalize implementation, plus a regular-expression sweep for combining marks, so the result is identical to what any standards-compliant tool would produce. It all happens in your tab: the text is never sent anywhere and no request is made. The stats record the form used, the character counts before and after, and whether the output actually differs from the input, which is the quickest way to confirm that a normalization really was needed.',
    },
  ],
  faq: [
    {
      q: 'Which form should I use?',
      a: 'NFC is a safe default for storage and comparison. NFKC and NFKD also fold compatibility characters such as full-width letters and circled digits, so use them only when that loss of distinction is intended.',
    },
    {
      q: 'Does this upload my text?',
      a: 'No. Normalization uses the browser’s built-in String.normalize API and runs entirely on your device.',
    },
    {
      q: 'Why do two identical-looking strings compare as different?',
      a: 'The same visible character can be stored in more than one way — é as one precomposed code point or as e followed by a combining acute accent. Normalizing both to NFC collapses those spellings into one canonical sequence so an equality test or a database key actually matches.',
    },
  ],
} as const;
