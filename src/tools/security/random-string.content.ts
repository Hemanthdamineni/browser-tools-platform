/**
 * Editorial content for the random-string tool page.
 *
 * Kept out of ``random-string.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it produces and how it comes back',
      body: 'Choose a length, a character set and how many strings you need; the result is the strings separated by newlines in a code view that saves as random-strings.txt. The stats line reports the resolved set size, the length used, the rounded entropy in bits and how many were generated.',
    },
    {
      heading: 'Rejection sampling, not a modulo shortcut',
      body: 'Every character index comes from crypto.getRandomValues and is accepted only when it falls below the largest multiple of the set size, so no character is favoured. That differs measurably from simply taking a random 32-bit value modulo the alphabet length, which skews short sets such as the ten digits.',
    },
    {
      heading: 'Presets, custom sets and silent clamping',
      body: 'Nine presets run from letters-only through hex to base64url, and the custom field collapses duplicates, so "aab" behaves like "ab"; an empty custom set is rejected. Length and count are clamped rather than refused, so asking for 5000 characters quietly yields 4096 and asking for 500 strings yields 200.',
    },
    {
      heading: 'Entropy figures and where the bytes come from',
      body: 'The entropy shown is log2 of the set size multiplied by the length, so 32 alphanumeric characters reads as roughly 191 bits; it describes one string, not the whole batch. The workbench text area is unused, every parameter is an option, and no request is made — the values are drawn on your device.',
    },
  ],
  faq: [
    {
      q: 'How is bias avoided?',
      a: 'Each character index is read as an unsigned 32-bit integer; values in the short final block that would over-represent some characters are discarded and re-drawn (rejection sampling).',
    },
    {
      q: 'What happens with duplicate custom characters?',
      a: 'Duplicates are collapsed, so "aab" behaves like "ab". An empty custom set is rejected.',
    },
    {
      q: 'Is this suitable for tokens and salts?',
      a: 'Yes — the randomness comes from crypto.getRandomValues, the same CSPRNG used for cryptographic keys. The entropy figure shown is log2(set size) × length.',
    },
  ],
} as const;
