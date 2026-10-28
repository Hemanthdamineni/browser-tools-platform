/**
 * Editorial content for the known-hosts-inspector tool page.
 *
 * Kept out of `known-hosts-inspector.meta.ts` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the audit reads',
      body: 'Paste the contents of ~/.ssh/known_hosts and the tool separates plaintext host-pattern entries from OpenSSH hashed |1|salt|hash| records, decodes every embedded host key (ED25519, RSA, ECDSA) and prints its key type, bit size and SHA256 and MD5 fingerprints — the same strings ssh-keygen -lf prints, computed on-device.',
    },
    {
      heading: 'The findings that matter',
      body: "The audit flags the situations worth acting on: the same host bound to two different keys (a host-key change, which can be legitimate rotation or a man-in-the-middle), one key spread across many hosts, duplicate entries, wildcard and negated patterns, bracketed [host]:port forms and malformed lines that SSH will ignore. A lookup view matches any hostname you type against plaintext patterns by wildcard and against hashed records by recomputing the HMAC-SHA1 with each entry's salt.",
    },
    {
      heading: 'Reading a hashed entry',
      body: 'OpenSSH hashes hostnames so the file on disk does not reveal which servers you connect to. The stored hash is HMAC-SHA1 keyed by a per-entry random salt over the hostname, base64-encoded. That is one-way: the tool cannot tell you which host a hash covers, but given a hostname it can tell you whether that hash covers the hostname — which is exactly what you need when checking whether a connection is protected by an existing record.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Everything is parsed in your browser with the Web Crypto API; nothing is transmitted and the tool works offline. Fingerprints are computed from the decoded key bytes, so they agree with ssh-keygen. The file can be up to 8 MB, which covers any realistic known_hosts.',
    },
  ],
  faq: [
    {
      q: 'Is the host key data sent anywhere?',
      a: 'No. The known_hosts contents are parsed entirely in your browser with the Web Crypto API; nothing is transmitted and the tool works fully offline.',
    },
    {
      q: 'What does a |1|salt|hash| entry mean?',
      a: 'OpenSSH hashes hostnames to keep your SSH history private on disk. The stored value is HMAC-SHA1(key=salt, message=hostname) base64-encoded. The inspector recomputes that hash on-device for the hostname you type, so it can tell you whether a hashed entry covers that host without ever revealing which hosts you use.',
    },
    {
      q: 'Why does my known_hosts show the same key for several hosts?',
      a: 'A single host key is often shared across hostnames of the same server (github.com and api.github.com, or a box reachable by several names). That is normal; the inspector only warns when one key is spread suspiciously wide or when the same host maps to two different keys.',
    },
    {
      q: 'What does a host-key change finding mean?',
      a: 'When the same host pattern is bound to two different key blobs, the key changed between the two records. That can be a legitimate key rotation, or it can mean a man-in-the-middle. The inspector shows both fingerprints side by side so you can compare against what your administrator published.',
    },
  ],
};
