import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'basic-auth',
  name: 'HTTP Basic Auth Header',
  category: 'web',
  summary: 'Build or decode HTTP Basic Authorization headers, UTF-8 safe.',
  description:
    'Build an Authorization: Basic header from a username and password, or decode an existing one back to its credentials. Handles non-ASCII characters correctly by encoding UTF-8 before base64.',
  keywords: [
    'basic auth',
    'basic authentication',
    'authorization header',
    'http auth',
    'base64 credentials',
    'basic base64',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'build',
      choices: [
        { value: 'build', label: 'Build header' },
        { value: 'decode', label: 'Decode header' },
      ],
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
  ],
  examples: [
    {
      title: 'Classic RFC 7617 example',
      options: { mode: 'build', username: 'Aladdin', password: 'open sesame' },
    },
    {
      title: 'Decode',
      input: 'Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
      options: { mode: 'decode' },
    },
    {
      title: 'Build with non-ASCII credentials',
      options: { mode: 'build', username: 'josé', password: 'pässwörd' },
    },
  ],
  article: [
    {
      heading: 'What Basic auth actually sends',
      body: 'RFC 7617 joins the username and password with a colon, base64-encodes the result and sends it as Authorization: Basic <token>. Build mode hands back that finished header line, ready to paste into curl, a fetch call or an API client; decode mode splits the recovered string at the first colon back into a username and a password.',
    },
    {
      heading: 'Why UTF-8 matters here',
      body: 'Base64 works on bytes, not characters, and older implementations encoded whatever the local code page happened to be. This tool encodes the credential string as UTF-8 first, so an accented username or a password in another script produces the token every browser agrees on. Entering nothing raises a warning that the token encodes an empty pair.',
    },
    {
      heading: 'Decoding real headers',
      body: 'Paste the whole header line or just the token: a leading "Authorization:" and the "Basic " prefix are stripped case-insensitively and surrounding whitespace is ignored. The token must be valid base64, and once decoded must contain a colon; a missing colon gets its own error explaining the username:password form.',
    },
    {
      heading: 'The security caveat, and where this runs',
      body: 'Basic auth encrypts nothing: the token is only base64, which anyone can reverse, and it is sent on every request by the client that holds it, so it is safe only over HTTPS and only for credentials you accept exposing. The encoding and decoding use the browser\u2019s own functions in this tab, so a password you type to build a header stays on your device.',
    },
  ],
  faq: [
    {
      q: 'Where does the header go?',
      a: 'Send it as a plain HTTP header: Authorization: Basic <token>. The browser or HTTP client attaches it to every request; it never touches this page once you copy it.',
    },
    {
      q: 'Does Basic auth encrypt my password?',
      a: 'No. Base64 is an encoding, not encryption \u2014 anyone holding the header can read the credentials instantly. Only ever use it over HTTPS, and prefer a token-based scheme for anything sensitive.',
    },
    {
      q: 'Why did decoding fail with a colon error?',
      a: 'The base64 decoded correctly but contained no colon, so it cannot be a Basic credential pair. Check that you pasted the whole token and not just the username, and that the padding = characters were not dropped.',
    },
  ],
  related: ['url-parse', 'jwt-decode', 'base64'],
  status: 'stable',
};
