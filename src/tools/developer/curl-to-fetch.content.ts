/**
 * Editorial content for the curl-to-fetch tool page.
 *
 * Kept out of ``curl-to-fetch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What comes back',
      body: 'Paste a curl command, line continuations and quotes and all, and the tool prints the equivalent client code for the target you choose. JavaScript fetch produces a URL plus an options object with method, headers and body; axios produces the config-object style; Python requests produces a requests.request(...) call. Input is capped at 100,000 characters.',
    },
    {
      heading: 'How the request is reconstructed',
      body: 'The parser reads the request-shaping flags: -X for the method, -H for headers, the -d family for a body, -u for Basic auth, -b for cookies, -A for user-agent, -e for referer, -G to move data into the query string, -I for a HEAD and -F for multipart form fields. An explicit -X wins; otherwise a body implies POST and -I implies HEAD, and with neither the request is a GET.',
    },
    {
      heading: 'The three switches that matter',
      body: 'The target select picks the language and library. Pretty-print JSON bodies decides whether a JSON payload becomes an indented object or a single-line string, and the non-2xx error check adds fetch boilerplate that throws on a non-ok response, which is why generated fetch is longer than a bare one-liner.',
    },
    {
      heading: 'What it deliberately does not do',
      body: 'Anything that cannot survive into client code is reported as a note rather than dropped silently: -L, -k, --compressed, output and cookie-jar flags, timeouts, proxies, interfaces and unknown tokens all get an explicit warning, and a header without a colon is noted as ignored. The converter never executes, follows or even resolves the URL \u2014 it only rewrites your text, on your device, so the credentials inside it never leave the tab.',
    },
  ],
  faq: [
    {
      q: 'Which curl flags are understood?',
      a: 'The request-shaping flags: -X/--request, -H/--header, -d/--data/--data-raw/--data-binary/--data-urlencode, --url, -u/--user, -b/--cookie, -A/--user-agent, -e/--referer, -G, -I/--head and -F/--form. Fetch-affecting flags such as -L, -k, --compressed, -o and proxy options are reported in the notes because the generated snippet cannot carry them portably.',
    },
    {
      q: 'How is the HTTP method decided?',
      a: 'An explicit -X wins. Otherwise a body implies POST and -I implies HEAD; with none of those the request is a GET.',
    },
    {
      q: 'What happens to -d data?',
      a: 'If the data parses as JSON it is emitted as a pretty-printed object (with JSON.stringify for fetch) and a JSON content type is added when you did not set one. Otherwise it is emitted as a quoted string, and --data-urlencode values become URL-encoded form fields.',
    },
  ],
} as const;
