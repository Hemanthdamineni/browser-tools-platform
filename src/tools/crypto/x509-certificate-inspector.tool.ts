import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './x509-certificate-inspector.meta';

type Row = [string, string];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, '');
  if (!clean) throw new ToolError('No base64 data found in the certificate.');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    const v = B64.indexOf(ch);
    if (v === -1)
      throw new ToolError('The certificate contains characters outside the base64 alphabet.');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function toHex(bytes: Uint8Array, sep = ''): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
    if (i < bytes.length - 1) out += sep;
  }
  return out;
}

function colons(hexStr: string): string {
  return hexStr.replace(/(.{2})(?=.)/g, '$1:');
}

function bigIntBits(bytes: Uint8Array): number {
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) start++;
  const rem = bytes.length - start;
  if (rem === 0) return 0;
  let lead = 0;
  let x = bytes[start]!;
  while (x < 128) {
    x <<= 1;
    lead++;
  }
  return rem * 8 - lead;
}

// ── Minimal ASN.1 DER reader ───────────────────────────────────────────────

interface DerNode {
  tag: number; // tag byte (universal/context etc.)
  cls: number; // class bits 0..3
  constructed: boolean;
  value: Uint8Array; // bare value or child bytes
  children: DerNode[];
}

function readDer(bytes: Uint8Array, offset: number): { el: DerNode; next: number } {
  const tag = bytes[offset]!;
  const cls = (tag >> 6) & 3;
  const constructed = (tag & 0x20) !== 0;
  let p = offset + 1;
  let len = bytes[p]!;
  p++;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + bytes[p + i]!;
    p += n;
  }
  const end = p + len;
  if (end > bytes.length) throw new ToolError('Truncated DER data in the certificate.');
  const el: DerNode = { tag, cls, constructed, value: bytes.subarray(p, end), children: [] };
  if (constructed) {
    let childAt = p;
    while (childAt < end) {
      const child = readDer(bytes, childAt);
      el.children.push(child.el);
      childAt = child.next;
    }
  }
  return { el, next: end };
}

function oidToString(v: Uint8Array): string {
  if (v.length === 0) return '';
  const parts: number[] = [];
  let value = 0;
  let first2 = false;
  for (const byte of v) {
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      if (!first2) {
        parts.push(Math.floor(value / 40), value % 40);
        first2 = true;
      } else {
        parts.push(value);
      }
      value = 0;
    }
  }
  return parts.join('.');
}

function asnTimeToDate(v: Uint8Array): Date | null {
  let s = new TextDecoder().decode(v).replace(/Z$/, '');
  let yr: number;
  if (s.length === 12) {
    // UTCTime: YYMMDDHHMMSS
    const yy = Number(s.slice(0, 2));
    yr = yy >= 50 ? 1900 + yy : 2000 + yy;
    s = String(yr) + s.slice(2);
  } else if (s.length === 14) {
    yr = Number(s.slice(0, 4));
  } else {
    return null;
  }
  const mon = Number(s.slice(4, 6));
  const day = Number(s.slice(6, 8));
  const hh = Number(s.slice(8, 10));
  const mm = Number(s.slice(10, 12));
  const ss = Number(s.slice(12, 14) || 0);
  const d = new Date(Date.UTC(yr, mon - 1, day, hh, mm, ss));
  return Number.isNaN(d.getTime()) ? null : d;
}

const OID_LABELS: Record<string, string> = {
  '2.5.4.3': 'commonName',
  '2.5.4.4': 'surname',
  '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'countryName',
  '2.5.4.7': 'localityName',
  '2.5.4.8': 'stateOrProvinceName',
  '2.5.4.10': 'organizationName',
  '2.5.4.11': 'organizationalUnitName',
  '2.5.4.17': 'postalCode',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '0.9.2342.19200300.100.1.25': 'dc',
};

function sigAlg(oid: string): string {
  switch (oid) {
    case '1.2.840.113549.1.1.11':
      return 'sha256WithRSAEncryption';
    case '1.2.840.113549.1.1.12':
      return 'sha384WithRSAEncryption';
    case '1.2.840.113549.1.1.13':
      return 'sha512WithRSAEncryption';
    case '1.2.840.113549.1.1.5':
      return 'sha1WithRSAEncryption';
    case '1.2.840.113549.1.1.4':
      return 'md5WithRSAEncryption';
    case '1.2.840.10045.4.3.2':
      return 'ecdsa-with-SHA256';
    case '1.2.840.10045.4.3.3':
      return 'ecdsa-with-SHA384';
    case '1.2.840.10045.4.3.4':
      return 'ecdsa-with-SHA512';
    case '1.2.840.10045.4.3':
      return 'ecdsa-with-SHA1';
    case '1.2.840.10040.4.3':
      return 'dsa-with-SHA1';
    case '1.3.101.112 with sha256':
      return 'ed25519';
    default:
      return oid;
  }
}

function parseName(el: DerNode): string {
  const parts: string[] = [];
  for (const setName of el.children) {
    if (setName.tag !== 0x31) continue;
    for (const attr of setName.children) {
      if (attr.tag !== 0x30 || attr.children.length < 2) continue;
      const oidEl = attr.children[0]!;
      const valEl = attr.children[1]!;
      if (oidEl.tag !== 0x06) continue;
      const oid = oidToString(oidEl.value);
      let val: string;
      if (valEl.tag === 0x02) {
        val = toHex(valEl.value);
      } else {
        val = new TextDecoder().decode(valEl.value);
      }
      parts.push(`${OID_LABELS[oid] ?? oid}=${val}`);
    }
  }
  return parts.join(', ');
}

function parseExtensions(el: DerNode): string[] {
  const notes: string[] = [];
  for (const ext of el.children) {
    if (ext.tag !== 0x30 || ext.children.length < 2) continue;
    const oidEl = ext.children[0]!;
    if (oidEl.tag !== 0x06) continue;
    const oid = oidToString(oidEl.value);
    const valueEl = ext.children[ext.children.length - 1]!;
    const raw = valueEl.value;
    if (oid === '2.5.29.17') {
      // Subject Alternative Name: SEQUENCE of [2] DNSName / [7] iPAddress
      try {
        const seq = readDer(raw, 0).el;
        const dns: string[] = [];
        const ip: string[] = [];
        for (const gn of seq.children) {
          if (gn.tag === 0x82) dns.push(new TextDecoder().decode(gn.value));
          else if (gn.tag === 0x87)
            ip.push(gn.value.length === 4 ? [...gn.value].join('.') : toHex(gn.value));
        }
        const san: string[] = [];
        if (dns.length) san.push(`DNS: ${dns.join(', ')}`);
        if (ip.length) san.push(`IP: ${ip.join(', ')}`);
        if (san.length) notes.push(`Subject Alternative Name: ${san.join(' — ')}`);
      } catch {
        /* ignore malformed SAN */
      }
    } else if (oid === '2.5.29.19') {
      try {
        const seq = readDer(raw, 0).el;
        let ca = false;
        for (const b of seq.children) if (b.tag === 0x01) ca = b.value[0] !== 0;
        notes.push(`Basic Constraints: ${ca ? 'CA:TRUE' : 'CA:FALSE'}${ca ? '' : ''}`);
      } catch {
        /* ignore */
      }
    } else if (oid === '2.5.29.14' || oid === '2.5.29.35') {
      if (raw.length > 0 && raw[0] === 0x04) {
        // OCTET STRING wrapping a keyid; unwrap
        try {
          const inner = readDer(raw, 0).el;
          if (inner.tag === 0x04) notes.push(`Key Identifier: ${colons(toHex(inner.value))}`);
        } catch {
          /* ignore */
        }
      }
    } else if (oid === '2.5.29.15') {
      notes.push(`Key Usage: present`);
    }
  }
  return notes;
}

function parsePublicKey(spki: DerNode): {
  type: string;
  bits: number;
  modulusHex: string;
  exponent: string;
  curve: string;
} {
  const algs = spki.children[0];
  const bitStr = spki.children[1];
  if (!algs || !bitStr) throw new ToolError('Missing SubjectPublicKeyInfo fields.');
  const type = algs.children[0] ? oidToString(algs.children[0].value) : '';
  let bits = 0;
  let modulusHex = '';
  let exponent = '';
  let curve = '';
  if (type === '1.2.840.113549.1.1.1') {
    // RSA: inner SEQUENCE of two INTEGERs (skip the BIT STRING unused-bits byte)
    try {
      const inner = readDer(bitStr.value.subarray(1), 0).el;
      if (inner.children.length >= 2) {
        const nEl = inner.children[0]!;
        const eEl = inner.children[1]!;
        bits = bigIntBits(nEl.value);
        let nArr = nEl.value;
        if (nArr.length > 1 && nArr[0] === 0) nArr = nArr.subarray(1);
        modulusHex = toHex(nArr).slice(0, 64);
        exponent = toHex(eEl.value);
      }
    } catch {
      /* ignore */
    }
  } else if (type === '1.2.840.10045.2.1') {
    // ECDSA: params hold the curve OID
    if (algs.children.length > 1) {
      const curveOid = oidToString(algs.children[1]!.value);
      curve = OID_LABELS[curveOid] ?? curveOid;
      bits =
        curveOid === '1.2.840.10045.3.1.7'
          ? 256
          : curveOid === '1.3.132.0.34'
            ? 384
            : curveOid === '1.3.132.0.35'
              ? 521
              : 0;
    }
    bits = bits || bitStr.value.length * 8;
  } else if (type === '1.3.101.112') {
    bits = 256;
  } else if (type === '1.2.840.10040.4.1') {
    try {
      const inner = readDer(bitStr.value, 0).el;
      if (inner.children[0]) bits = bigIntBits(inner.children[0]!.value);
    } catch {
      /* ignore */
    }
  }
  const typeLabel =
    type === '1.2.840.113549.1.1.1'
      ? 'RSA'
      : type === '1.2.840.10045.2.1'
        ? 'ECDSA'
        : type === '1.3.101.112'
          ? 'Ed25519'
          : type === '1.2.840.10040.4.1'
            ? 'DSA'
            : type || 'unknown';
  return { type: typeLabel, bits, modulusHex, exponent, curve };
}

function stripPem(s: string): string {
  const m = s.match(/-----BEGIN [^-]*-----([\s\S]*?)-----END [^-]*-----/);
  return (m ? m[1]! : s).trim();
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const raw = input.text.trim();
  if (!raw) {
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }),
      render: 'table',
      notes: [
        'Paste a PEM certificate (-----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----) to inspect it.',
      ],
    };
  }
  const body = stripPem(raw);
  const der = base64Decode(body);
  let cert: DerNode;
  try {
    cert = readDer(der, 0).el;
  } catch (e) {
    throw new ToolError(`Invalid certificate structure: ${(e as Error).message}`);
  }
  if (cert.tag !== 0x30) throw new ToolError('The certificate is not a DER SEQUENCE.');
  const tbs = cert.children[0];
  if (!tbs || tbs.tag !== 0x30) throw new ToolError('Missing TBSCertificate.');
  const tbsChildren = tbs.children;

  // Optional leading [0] version for V3 certificates.
  let tb = 0;
  if (tbsChildren[0] && tbsChildren[0].tag === 0xa0) tb = 1;

  const serialEl = tbsChildren[tb]!;
  const sigAlgEl = tbsChildren[tb + 1]!;
  const issuerEl = tbsChildren[tb + 2]!;
  const validityEl = tbsChildren[tb + 3]!;
  const subjectEl = tbsChildren[tb + 4]!;
  const spkiEl = tbsChildren[tb + 5]!;

  const serial = colons(toHex(serialEl.value));
  const sigOidEl = sigAlgEl.children[0];
  const sigLabel = sigOidEl ? sigAlg(oidToString(sigOidEl.value)) : 'unknown';

  const notBefore = asnTimeToDate(validityEl.children[0]!.value);
  const notAfter = asnTimeToDate(validityEl.children[1]!.value);

  const now = Date.now();
  const status =
    !notAfter || !notBefore
      ? '(unparsed)'
      : now < notBefore.getTime()
        ? 'Not yet valid'
        : now > notAfter.getTime()
          ? 'EXPIRED'
          : 'Valid';
  const daysLeft = notAfter ? Math.floor((notAfter.getTime() - now) / 86400000) : null;

  const key = parsePublicKey(spkiEl);
  const extensionNotes: string[] = [];
  const extWrapper = tbsChildren.find(
    (c) => c.cls === 2 && c.tag === 0xa3 && c.constructed && c.children.length > 0,
  );
  if (extWrapper) {
    for (const extSeq of extWrapper.children) {
      if (extSeq.tag === 0x30) extensionNotes.push(...parseExtensions(extSeq));
    }
  }

  // Fingerprints are over the whole DER certificate.
  const digestBuf = await crypto.subtle.digest('SHA-256', der as unknown as BufferSource);
  const digestBuf1 = await crypto.subtle.digest('SHA-1', der as unknown as BufferSource);

  const rows: Row[] = [
    ['Subject', parseName(subjectEl)],
    ['Issuer', parseName(issuerEl)],
    ['Serial number', serial],
    ['Signature algorithm', sigLabel],
    [
      'Not before',
      notBefore ? notBefore.toISOString().replace('T', ' ').replace('Z', ' UTC') : '(unparsed)',
    ],
    [
      'Not after',
      notAfter ? notAfter.toISOString().replace('T', ' ').replace('Z', ' UTC') : '(unparsed)',
    ],
    ['Validity status', status],
    ['Days remaining', daysLeft === null ? '(unparsed)' : String(daysLeft)],
    ['Public key type', key.type],
    ['Key size', key.bits ? `${key.bits} bits` : '(n/a)'],
    ['RSA modulus', key.modulusHex ? `${key.modulusHex}…` : '(e.g. ECDSA curve shown below)'],
    ['RSA exponent', key.exponent ? `0x${key.exponent}` : ''],
    ['Curve', key.curve || '—'],
  ];

  const sha256hex = Array.from(new Uint8Array(digestBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const sha1hex = Array.from(new Uint8Array(digestBuf1))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const notes: string[] = [];
  notes.push(`SHA-256 fingerprint: ${colons(sha256hex)}`);
  notes.push(`SHA-1 fingerprint: ${colons(sha1hex)}`);
  if (extensionNotes.length) notes.push(...extensionNotes);

  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: { bytes: der.length, bits: key.bits, status, days: daysLeft ?? 0 },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
