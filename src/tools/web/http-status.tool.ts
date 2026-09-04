import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { meta } from './http-status.meta';

/** [code, name, meaning] — the current IANA registry plus RFC-defined extras. */
const CODES: [number, string, string][] = [
  [100, 'Continue', 'Client should continue with the request body.'],
  [101, 'Switching Protocols', 'Server agrees to switch protocols (e.g. to WebSocket).'],
  [102, 'Processing', 'Server has received the request and is still working (WebDAV).'],
  [103, 'Early Hints', 'Preliminary response headers sent before the final response.'],
  [200, 'OK', 'Standard success response.'],
  [201, 'Created', 'Request succeeded and a new resource was created.'],
  [202, 'Accepted', 'Request accepted but not yet processed.'],
  [203, 'Non-Authoritative Information', 'Response comes from a cache or proxy, not the origin.'],
  [204, 'No Content', 'Success with no response body.'],
  [205, 'Reset Content', 'Client should reset the document view.'],
  [206, 'Partial Content', 'Partial resource delivered (Range request).'],
  [207, 'Multi-Status', 'Multiple statuses for a batch operation (WebDAV).'],
  [208, 'Already Reported', 'Members of a collection were already reported (WebDAV).'],
  [226, 'IM Used', 'Delta encoding applied to the response.'],
  [300, 'Multiple Choices', 'Several options exist for the requested resource.'],
  [301, 'Moved Permanently', 'Resource has a new permanent URL.'],
  [302, 'Found', 'Resource temporarily lives at a different URL.'],
  [303, 'See Other', 'Fetch the resource with GET at another URL.'],
  [304, 'Not Modified', 'Cached version is still fresh.'],
  [305, 'Use Proxy', 'Proxy required (deprecated).'],
  [307, 'Temporary Redirect', 'Same-method redirect; do not change the verb.'],
  [308, 'Permanent Redirect', 'Permanent same-method redirect.'],
  [400, 'Bad Request', 'Malformed request syntax or invalid framing.'],
  [401, 'Unauthorized', 'Authentication is required and has failed or is missing.'],
  [402, 'Payment Required', 'Reserved for future use.'],
  [403, 'Forbidden', 'Authenticated but not allowed to access the resource.'],
  [404, 'Not Found', 'No resource at this URL.'],
  [405, 'Method Not Allowed', 'HTTP verb not supported by this resource.'],
  [406, 'Not Acceptable', 'No representation matches the Accept headers.'],
  [407, 'Proxy Authentication Required', 'The proxy needs credentials.'],
  [408, 'Request Timeout', 'Client took too long to send the request.'],
  [409, 'Conflict', 'Request conflicts with the current state of the resource.'],
  [410, 'Gone', 'Resource permanently removed — do not retry.'],
  [411, 'Length Required', 'Content-Length header is required.'],
  [412, 'Precondition Failed', 'A conditional header evaluated to false.'],
  [413, 'Content Too Large', 'Request body exceeds server limits.'],
  [414, 'URI Too Long', 'Request URL exceeds server limits.'],
  [415, 'Unsupported Media Type', 'Request format not supported.'],
  [416, 'Range Not Satisfiable', 'Requested range is outside the resource size.'],
  [417, 'Expectation Failed', 'Expect header could not be satisfied.'],
  [418, "I'm a teapot", 'RFC 2324 April Fools; adopted as a real joke status.'],
  [421, 'Misdirected Request', 'Request sent to a server that cannot produce a response.'],
  [422, 'Unprocessable Content', 'Syntactically valid but semantically wrong (WebDAV).'],
  [423, 'Locked', 'Resource is locked (WebDAV).'],
  [424, 'Failed Dependency', 'A dependent request failed (WebDAV).'],
  [425, 'Too Early', 'Server unwilling to process a replayed early-data request.'],
  [426, 'Upgrade Required', 'Client must switch protocols (e.g. TLS).'],
  [428, 'Precondition Required', 'Server requires conditional requests to avoid lost updates.'],
  [429, 'Too Many Requests', 'Rate limit exceeded — slow down.'],
  [431, 'Request Header Fields Too Large', 'Headers exceed the server’s size limit.'],
  [451, 'Unavailable For Legal Reasons', 'Access blocked for legal/censorship reasons.'],
  [500, 'Internal Server Error', 'Unexpected server-side failure.'],
  [501, 'Not Implemented', 'Server does not support this functionality.'],
  [502, 'Bad Gateway', 'Upstream server returned an invalid response.'],
  [503, 'Service Unavailable', 'Overloaded or down for maintenance.'],
  [504, 'Gateway Timeout', 'Upstream server did not respond in time.'],
  [505, 'HTTP Version Not Supported', 'Protocol version not supported.'],
  [506, 'Variant Also Negotiates', 'Transparent content negotiation loop.'],
  [507, 'Insufficient Storage', 'Server out of storage (WebDAV).'],
  [508, 'Loop Detected', 'Infinite loop while processing (WebDAV).'],
  [510, 'Not Extended', 'Further extensions required to fulfil the request.'],
  [511, 'Network Authentication Required', 'Captive portal login needed first.'],
  /* __MORE__ */
];

const HEADERS = ['Code', 'Name', 'Meaning'];

function run(input: TextRunInput): TextRunResult {
  const o = input.options ?? {};
  const category = String(o.category ?? 'all');
  const query = (input.text ?? '').trim();
  let rows: [number, string, string][];

  if (!query) {
    rows = category === 'all' ? CODES : CODES.filter((c) => String(c[0])[0] === category[0]);
  } else if (/^\d{3}$/.test(query)) {
    const code = Number(query);
    rows = CODES.filter((c) => c[0] === code);
    if (!rows.length) {
      return {
        output: JSON.stringify({ headers: HEADERS, rows: [] }),
        render: 'table',
        notes: [`Status ${code} is not in the standard registry.`],
      };
    }
  } else {
    const q = query.toLowerCase();
    rows = CODES.filter((c) => c[1].toLowerCase().includes(q) || c[2].toLowerCase().includes(q));
    if (!rows.length) {
      return {
        output: JSON.stringify({ headers: HEADERS, rows: [] }),
        render: 'table',
        notes: [`No status code matching "${query}".`],
      };
    }
  }

  return {
    output: JSON.stringify({ headers: HEADERS, rows: rows.map((r) => r.map(String)) }),
    render: 'table',
    stats: { matches: rows.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
