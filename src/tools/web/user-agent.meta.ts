import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'user-agent',
  name: 'User-Agent Parser',
  category: 'web',
  summary: 'Break a User-Agent string into browser, version, OS, engine and device type.',
  description:
    'Paste any User-Agent string to identify the browser and version, operating system and version, rendering engine, device type and whether it is a bot or crawler. Uses a heuristic regex parser — no network lookup, everything on-device.',
  keywords: [
    'user agent',
    'user-agent parser',
    'parse user agent',
    'browser detection',
    'os detection',
    'crawler detection',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    {
      title: 'Chrome on Windows',
      input:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    { title: 'curl', input: 'curl/8.4.0' },
    {
      title: 'Mobile Safari on an iPhone',
      input:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    },
  ],
  faq: [
    {
      q: 'Is the parser infallible?',
      a: 'No. User-agent strings are free-form text and browsers misrepresent each other for compatibility (the "like Gecko" convention). Results are best-effort heuristics, ordered so the most specific signal wins.',
    },
    {
      q: 'How is the device type decided?',
      a: 'Crawler markers are checked first, so any string matching a known bot pattern is reported as bot. Otherwise tablet markers such as iPad and Silk win next, then phone markers such as iPhone and Android Mobile, and everything else is reported as desktop.',
    },
    {
      q: 'Which clients does it recognise?',
      a: 'The browser rules are tried most specific first: Edge, Opera, Samsung Internet, Chrome, Firefox, cURL, wget, Internet Explorer, Safari and Python requests. A string that matches none of them is reported as Unknown with the remaining fields still filled in where the OS is identifiable.',
    },
  ],
article: [
    {
      heading: 'What the User-Agent parser reports',
      body: 'Paste any User-Agent string and the tool returns a table of browser and version, operating system and OS version, rendering engine, device type and whether the string looks like a bot. Device type is one of desktop, mobile, tablet or bot, and unknown parts are shown as a dash rather than left blank.',
    },
    {
      heading: 'Triaging a support report',
      body: 'Use it when a user reports a bug and pastes their User-Agent line, or when you want to know whether a hit in your logs was a real browser or a crawler. Pasting the string turns an opaque run of text into the browser, version and platform you need in order to reproduce the problem.',
    },
    {
      heading: 'No options, just a paste',
      body: 'There is nothing to configure: the parser applies its rules in order and returns the result. Browser rules are tried most specific first, so Edge is recognised before the Chrome token it embeds, and the engine is derived from the WebKit, Gecko and Trident tokens with a WebKit correction for Safari.',
    },
    {
      heading: 'Why the answer can be wrong',
      body: 'User-agent strings are free-form and clients misrepresent themselves for compatibility, which is why Chrome claims to be Mozilla and Safari, and why both claim to be like Gecko. The result is a best-effort reading of a heuristic string, so treat it as a strong hint rather than a verified fact.',
    },
    {
      heading: 'The string never leaves the page',
      body: 'Parsing happens entirely in your browser with no network lookup and no logging of the string you paste. It works offline, so a client fingerprint from a real session is examined without being sent anywhere.',
    },
  ],
  related: ['http-status', 'ip-address-inspector'],
  status: 'stable',
};
