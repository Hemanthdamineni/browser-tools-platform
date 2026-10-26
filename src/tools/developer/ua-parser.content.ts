/**
 * Editorial content for the ua-parser tool page.
 *
 * Kept out of ``ua-parser.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the decoded row set tells you',
      body: 'One User-Agent string becomes a six-row table: browser, browser version, rendering engine, operating system, OS version and device class. The device class distinguishes desktop, mobile, tablet and bot, and engine names such as Blink, WebKit, Gecko, Trident and EdgeHTML are reported from the token the string actually carries rather than from the browser name.',
    },
    {
      heading: 'Why the order of checks matters',
      body: 'Many browsers embed other products names for compatibility, so the parser tests in a deliberate order — Samsung Internet, then Edge variants, then Opera, then Chrome, Firefox, Safari — because a Chrome string also contains "Safari" and an Edge string contains "Chrome". Crawlers are detected first, with keyword matching for bot, spider or crawler tokens, because they rarely carry a browser token at all.',
    },
    {
      heading: 'Where the answer can be wrong',
      body: 'A User-Agent is self-reported text, not a contract: browsers freeze version numbers for privacy, extensions rewrite strings, and new products appear constantly. Detection is heuristic, so treat the result as a strong hint. Strings the rules do not recognise are shown as Unknown rather than being mapped to a neighbouring browser by guesswork.',
    },
    {
      heading: 'Nothing is looked up online',
      body: 'All matching happens against built-in rules in this page. The string is analysed locally, no request is sent to a device-detection service, and pasting a log line therefore reveals nothing about your traffic to a third party.',
    },
  ],
  faq: [
    {
      q: 'Which browsers are recognized?',
      a: 'Chrome, Firefox, Safari, Edge, Opera (and Opera GX), Samsung Internet, plus search/bot crawlers like Googlebot and Bingbot via keyword detection.',
    },
    {
      q: 'Is this an exhaustive lookup?',
      a: 'No. A User-Agent is a string, not a contract — detection is heuristic by design. Real products behave correctly for the common UAs this tool targets, and listed rules cover the mainstream long tail.',
    },
    {
      q: 'How is my data used?',
      a: 'This parser runs entirely in your browser. The string never leaves your device.',
    },
  ],
} as const;
