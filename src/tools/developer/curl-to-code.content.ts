/**
 * Editorial content for the curl-to-code tool page.
 *
 * Kept out of ``curl-to-code.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Paste a curl command and it is parsed into a small request model, then rendered as idiomatic code for JavaScript fetch, axios, Node https, Python requests, Go, PHP, Ruby, Java, C#, Rust, PowerShell, or a raw HTTP/1.1 request. The output is a code block whose language matches the chosen target, plus a request.txt or request.http filename and stats for the method, target, header count and body kind.',
    },
    {
      heading: 'When to use it',
      body: 'Use it when a docs page or a browser network tab shows a curl one-liner but you work in another language. Reproduce that exact request in your stack instead of hand-translating each flag, header and data body.',
    },
    {
      heading: 'The target option',
      body: 'The single option, target, picks the generator. Each language has its own escaping and library calls: fetch builds on Request and Headers, Python uses requests, Go uses net/http, and http emits a literal request block you can replay. Changing the target only changes how the same parsed request is rendered.',
    },
    {
      heading: 'Edge cases and limits',
      body: 'File uploads from -F only carry a local path such as @photo.png, so the generated multipart code marks where you must supply the File or Blob; the field names stay correct. Transport-specific flags like custom certificates become notes rather than being dropped, while unrecognised flags are ignored. Commands over 200,000 characters are rejected.',
    },
    {
      heading: 'Privacy',
      body: 'Parsing and code generation run entirely in this tab, so nothing is uploaded and the tool works offline. Since curl commands often hold tokens and cookies, trim or rotate any secrets before sharing the generated snippet.',
    },
  ],
  faq: [
    {
      q: 'Which curl flags are understood?',
      a: 'The request-shaping flags: -X/--request, -H/--header, -d/--data*, --json, -F/--form, -u/--user, -b/--cookie, -A/--user-agent, -e/--referer, -G/--get, -I/--head, -T/--upload-file, -L/--location, -k/--insecure, --compressed, -m/--max-time and -x/--proxy. Other flags are ignored, and genuinely transport-specific ones (custom certificates, --resolve) are reported as notes rather than silently dropped.',
    },
    {
      q: 'Why do file uploads show a TODO comment?',
      a: 'A curl command only contains a path such as @photo.png. The browser cannot read that local file from a pasted command, so the generated code marks where the File/Blob or stream should be supplied — the multipart structure and field names are still correct.',
    },
    {
      q: 'Is my command sent anywhere?',
      a: 'No. Parsing and code generation run entirely in your browser tab. Commands often contain tokens and cookies, so trim or rotate any secrets before sharing generated snippets.',
    },
  ],
} as const;
