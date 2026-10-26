/**
 * Editorial content for the license-generator tool page.
 *
 * Kept out of ``license-generator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it produces',
      body: 'Pick a license and the tool returns the complete canonical text with the year and copyright holder substituted in: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense or CC0-1.0. The output also carries a matching copyright header, except Unlicense and CC0-1.0, which are headerless by design.',
    },
    {
      heading: 'A good moment to reach for it',
      body: 'Starting a repository and needing a LICENSE file you can commit: choose MIT, confirm the year and your name, copy the text, and paste it in without revisiting a license website. The reverse case is just as common — an existing project has no LICENSE file and you want the exact canonical wording rather than a paraphrase copied from a blog post.',
    },
    {
      heading: 'What the fields change',
      body: "license selects the text and its header style — Apache-2.0 uses a bare 'Copyright' line while the others use 'Copyright (c)' with the holder. Leaving year blank or at its <current year> placeholder emits the present year; leaving the name at <your name> leaves a visible placeholder in both header and body rather than inventing a holder.",
    },
    {
      heading: 'Caveats worth knowing',
      body: 'The substituted texts are exactly what the license bodies say — nothing is validated against SPDX, and the tool only assembles text, so it gives no legal advice. Unlicense and CC0-1.0 ignore the holder field entirely because their texts waive rights rather than name an owner.',
    },
    {
      heading: 'Privacy',
      body: 'Nothing leaves the browser: the template, the substitution and the copy button all run on your device. The year and holder you type are never transmitted, and there is no network request that could leak what you are about to license.',
    },
  ],
  faq: [
    {
      q: 'Which licenses are included?',
      a: 'MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense and CC0-1.0 — the most common open-source licenses. Each text is the canonical text with just the year and holder substituted.',
    },
    {
      q: 'How do I pick the right license?',
      a: 'For most libraries use MIT, Apache-2.0 or BSD-3. If you want to waive all rights use Unlicense or CC0-1.0. This tool only produces the text — check the license’s terms with your own legal counsel before choosing.',
    },
    {
      q: 'Is the output the full official text?',
      a: 'Yes — you can paste it directly into a LICENSE file. The texts are the standard license texts with the year and holder substituted; verify against the SPDX reference if you ship to a regulated environment.',
    },
  ],
} as const;
