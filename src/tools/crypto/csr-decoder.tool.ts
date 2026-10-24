import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csr-decoder.meta';

const MAX_BYTES = 1024 * 1024;
const MAX_FINDINGS = 300;
const MAX_ROWS = 200;
const CLIP = 120;

type Hash = 'SHA-1' | 'SHA-224' | 'SHA-256' | 'SHA-384' | 'SHA-512';
type VerifyResult = 'valid' | 'invalid' | 'unsupported' | 'unavailable' | 'skipped';

class DerError extends Error {}

interface Tlv {
  tag: number;
  constructed: boolean;
  cls: number;
  value: Uint8Array;
  full: Uint8Array;
  end: number;
}

const DN_ATTRIBUTES = new Map<string, { short: string; name: string }>([
  ['2.5.4.3', { short: 'CN', name: 'Common Name' }],
  ['2.5.4.4', { short: 'SN', name: 'Surname' }],
  ['2.5.4.5', { short: 'serialNumber', name: 'Serial Number' }],
  ['2.5.4.6', { short: 'C', name: 'Country' }],
  ['2.5.4.7', { short: 'L', name: 'Locality' }],
  ['2.5.4.8', { short: 'ST', name: 'State or Province' }],
  ['2.5.4.9', { short: 'street', name: 'Street Address' }],
  ['2.5.4.10', { short: 'O', name: 'Organization' }],
  ['2.5.4.11', { short: 'OU', name: 'Organizational Unit' }],
  ['2.5.4.12', { short: 'title', name: 'Title' }],
  ['2.5.4.42', { short: 'GN', name: 'Given Name' }],
  ['2.5.4.97', { short: 'organizationIdentifier', name: 'Organization Identifier' }],
  ['1.2.840.113549.1.9.1', { short: 'emailAddress', name: 'Email Address' }],
  ['0.9.2342.19200300.100.1.25', { short: 'DC', name: 'Domain Component' }],
  ['0.9.2342.19200300.100.1.1', { short: 'UID', name: 'User ID' }],
]);

const EXTENSIONS = new Map<string, string>([
  ['2.5.29.17', 'subjectAltName'],
  ['2.5.29.15', 'keyUsage'],
  ['2.5.29.37', 'extendedKeyUsage'],
  ['2.5.29.19', 'basicConstraints'],
  ['2.5.29.14', 'subjectKeyIdentifier'],
  ['2.5.29.9', 'subjectDirectoryAttributes'],
  ['2.5.29.31', 'cRLDistributionPoints'],
  ['2.5.29.32', 'certificatePolicies'],
  ['1.3.6.1.5.5.7.1.1', 'authorityInfoAccess'],
  ['1.3.6.1.5.5.7.1.24', 'tlsFeature'],
]);

const ATTRIBUTE_NAMES = new Map<string, string>([
  ['1.2.840.113549.1.9.7', 'challengePassword'],
  ['1.2.840.113549.1.9.2', 'unstructuredName'],
  ['1.2.840.113549.1.9.15', 'smimeCapabilities'],
  ['1.3.6.1.4.1.311.13.2.3', 'osVersion'],
]);

const SIGNATURE_ALGORITHMS = new Map<string, string>([
  ['1.2.840.113549.1.1.5', 'sha1WithRSAEncryption'],
  ['1.2.840.113549.1.1.14', 'sha224WithRSAEncryption'],
  ['1.2.840.113549.1.1.11', 'sha256WithRSAEncryption'],
  ['1.2.840.113549.1.1.12', 'sha384WithRSAEncryption'],
  ['1.2.840.113549.1.1.13', 'sha512WithRSAEncryption'],
  ['1.2.840.113549.1.1.10', 'rsassaPss'],
  ['1.2.840.10045.4.1', 'ecdsa-with-SHA1'],
  ['1.2.840.10045.4.3.1', 'ecdsa-with-SHA224'],
  ['1.2.840.10045.4.3.2', 'ecdsa-with-SHA256'],
  ['1.2.840.10045.4.3.3', 'ecdsa-with-SHA384'],
  ['1.2.840.10045.4.3.4', 'ecdsa-with-SHA512'],
  ['1.3.101.112', 'ED25519'],
  ['1.3.101.113', 'ED448'],
]);

const KEY_ALGORITHMS = new Map<string, string>([
  ['1.2.840.113549.1.1.1', 'RSA'],
  ['1.2.840.10045.2.1', 'EC'],
  ['1.3.101.112', 'Ed25519'],
  ['1.3.101.113', 'Ed448'],
  ['1.3.101.110', 'X25519'],
  ['1.3.101.111', 'X448'],
]);

const CURVES = new Map<string, { name: string; webcrypto: string; bits: number }>([
  ['1.2.840.10045.3.1.7', { name: 'prime256v1 (P-256)', webcrypto: 'P-256', bits: 256 }],
  ['1.3.132.0.34', { name: 'secp384r1 (P-384)', webcrypto: 'P-384', bits: 384 }],
  ['1.3.132.0.35', { name: 'secp521r1 (P-521)', webcrypto: 'P-521', bits: 521 }],
  ['1.3.132.0.10', { name: 'secp256k1', webcrypto: '', bits: 256 }],
  ['1.2.840.10045.3.1.1', { name: 'prime192v1 (P-192)', webcrypto: '', bits: 192 }],
]);

const RSA_SIGNATURE_HASHES = new Map<string, Hash>([
  ['1.2.840.113549.1.1.5', 'SHA-1'],
  ['1.2.840.113549.1.1.14', 'SHA-224'],
  ['1.2.840.113549.1.1.11', 'SHA-256'],
  ['1.2.840.113549.1.1.12', 'SHA-384'],
  ['1.2.840.113549.1.1.13', 'SHA-512'],
]);

const ECDSA_SIGNATURE_HASHES = new Map<string, Hash>([
  ['1.2.840.10045.4.1', 'SHA-1'],
  ['1.2.840.10045.4.3.1', 'SHA-224'],
  ['1.2.840.10045.4.3.2', 'SHA-256'],
  ['1.2.840.10045.4.3.3', 'SHA-384'],
  ['1.2.840.10045.4.3.4', 'SHA-512'],
]);

const KEY_USAGE_BITS = [
  'digitalSignature',
  'contentCommitment',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly',
];

const EKU_NAMES = new Map<string, string>([
  ['1.3.6.1.5.5.7.3.1', 'serverAuth'],
  ['1.3.6.1.5.5.7.3.2', 'clientAuth'],
  ['1.3.6.1.5.5.7.3.3', 'codeSigning'],
  ['1.3.6.1.5.5.7.3.4', 'emailProtection'],
  ['1.3.6.1.5.5.7.3.8', 'timeStamping'],
  ['1.3.6.1.5.5.7.3.9', 'OCSP signing'],
  ['2.5.29.37.0', 'anyExtendedKeyUsage'],
]);

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

function readTlv(bytes: Uint8Array, offset: number, limit: number): Tlv {
  if (offset + 2 > limit) throw new DerError('The data ends where a value was expected.');
  const tag = bytes[offset] ?? 0;
  let index = offset + 1;
  let length = bytes[index] ?? 0;
  index += 1;
  if (length === 0x80) throw new DerError('Indefinite lengths are not valid DER.');
  if ((length & 0x80) !== 0) {
    const count = length & 0x7f;
    if (count === 0 || count > 4) throw new DerError('That length encoding is not supported.');
    if (index + count > limit) throw new DerError('A length runs past the end of the data.');
    length = 0;
    for (let i = 0; i < count; i += 1) length = length * 256 + (bytes[index + i] ?? 0);
    index += count;
  }
  const valueEnd = index + length;
  if (valueEnd > limit) throw new DerError('A value runs past the end of the data.');
  return {
    tag,
    constructed: (tag & 0x20) !== 0,
    cls: (tag & 0xc0) >> 6,
    value: bytes.subarray(index, valueEnd),
    full: bytes.subarray(offset, valueEnd),
    end: valueEnd,
  };
}

function* children(node: Tlv): Generator<Tlv> {
  let offset = 0;
  while (offset < node.value.length) {
    const child = readTlv(node.value, offset, node.value.length);
    yield child;
    offset = child.end;
  }
}

const childList = (node: Tlv): Tlv[] => [...children(node)];

function expectTag(node: Tlv | undefined, tag: number, what: string): Tlv {
  if (node === undefined) throw new DerError('Missing ' + what + '.');
  if (node.tag !== tag) {
    throw new DerError('Expected ' + what + ' but found tag 0x' + node.tag.toString(16) + '.');
  }
  return node;
}

function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const parts: number[] = [];
  const first = bytes[0] ?? 0;
  if (first < 40) parts.push(0, first);
  else if (first < 80) parts.push(1, first - 40);
  else parts.push(2, first - 80);
  let value = 0;
  for (let i = 1; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

function decodeText(node: Tlv): string {
  if (node.tag === 0x1e) {
    try {
      return new TextDecoder('utf-16be').decode(node.value).trim();
    } catch {
      return '';
    }
  }
  return new TextDecoder('utf-8').decode(node.value).trim();
}

function integerValue(bytes: Uint8Array): number {
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return value;
}

function integerBits(bytes: Uint8Array): number {
  let index = 0;
  while (index < bytes.length - 1 && bytes[index] === 0) index += 1;
  const first = bytes[index] ?? 0;
  if (first === 0) return 0;
  let leading = 0;
  for (let mask = 0x80; mask > 0 && (first & mask) === 0; mask >>= 1) leading += 1;
  return (bytes.length - index) * 8 - leading;
}

function bitStringBits(value: Uint8Array): boolean[] {
  const unused = value[0] ?? 0;
  const bits: boolean[] = [];
  for (let i = 1; i < value.length; i += 1) {
    const byte = value[i] ?? 0;
    for (let mask = 0x80; mask > 0; mask >>= 1) bits.push((byte & mask) !== 0);
  }
  if (unused > 0) bits.length = Math.max(0, bits.length - unused);
  return bits;
}

function formatIp(bytes: Uint8Array): string {
  if (bytes.length === 4) return Array.from(bytes).join('.');
  if (bytes.length === 16) {
    const groups: number[] = [];
    for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
    let bestStart = -1;
    let bestLength = 0;
    let start = -1;
    let length = 0;
    groups.forEach((group, index) => {
      if (group === 0) {
        if (start === -1) start = index;
        length += 1;
        if (length > bestLength) {
          bestLength = length;
          bestStart = start;
        }
      } else {
        start = -1;
        length = 0;
      }
    });
    if (bestLength < 2) return groups.map((group) => group.toString(16)).join(':');
    const before = groups
      .slice(0, bestStart)
      .map((group) => group.toString(16))
      .join(':');
    const after = groups
      .slice(bestStart + bestLength)
      .map((group) => group.toString(16))
      .join(':');
    return before + '::' + after;
  }
  return '0x' + hex(bytes);
}

interface GeneralName {
  kind: string;
  value: string;
}

function decodeGeneralName(node: Tlv): GeneralName {
  const kind = node.tag & 0x1f;
  switch (kind) {
    case 1:
      return { kind: 'email', value: new TextDecoder('utf-8').decode(node.value) };
    case 2:
      return { kind: 'DNS', value: new TextDecoder('utf-8').decode(node.value) };
    case 6:
      return { kind: 'URI', value: new TextDecoder('utf-8').decode(node.value) };
    case 7:
      return { kind: 'IP', value: formatIp(node.value) };
    case 8:
      return { kind: 'OID', value: decodeOid(node.value) };
    case 4: {
      const parts = childList(node)
        .flatMap((rdn) => childList(rdn))
        .map((atv) => {
          const list = childList(atv);
          const oid = list[0] === undefined ? '' : decodeOid(list[0].value);
          const value = list[1] === undefined ? '' : decodeText(list[1]);
          return (DN_ATTRIBUTES.get(oid)?.short ?? oid) + '=' + value;
        });
      return { kind: 'dirName', value: parts.join(', ') };
    }
    default:
      return { kind: 'otherName[' + kind + ']', value: '0x' + hex(node.value).slice(0, 60) };
  }
}

function sanitizeNames(bytes: Uint8Array): GeneralName[] {
  const outer = readTlv(bytes, 0, bytes.length);
  return childList(outer).map((node) => decodeGeneralName(node));
}

interface Extension {
  oid: string;
  name: string;
  critical: boolean;
  decoded: string;
}

function decodeExtensionValue(oid: string, inner: Uint8Array): string {
  try {
    if (oid === '2.5.29.17') {
      return sanitizeNames(inner)
        .map((name) => name.kind + ':' + name.value)
        .join(', ');
    }
    if (oid === '2.5.29.15') {
      const bits = bitStringBits(readTlv(inner, 0, inner.length).value);
      return bits
        .map((set, index) => (set ? (KEY_USAGE_BITS[index] ?? 'bit' + index) : null))
        .filter((name): name is string => name !== null)
        .join(', ');
    }
    if (oid === '2.5.29.37') {
      const outer = readTlv(inner, 0, inner.length);
      return childList(outer)
        .map((node) => EKU_NAMES.get(decodeOid(node.value)) ?? decodeOid(node.value))
        .join(', ');
    }
    if (oid === '2.5.29.19') {
      const parts = childList(readTlv(inner, 0, inner.length));
      let isCa = false;
      const text: string[] = [];
      for (const part of parts) {
        if (part.tag === 0x01) isCa = (part.value[0] ?? 0) !== 0;
        if (part.tag === 0x02) text.push('pathLen=' + integerValue(part.value));
      }
      return 'CA=' + (isCa ? 'true' : 'false') + (text.length > 0 ? ', ' + text.join(', ') : '');
    }
    if (oid === '2.5.29.14' || oid === '2.5.29.35') {
      const inner2 = readTlv(inner, 0, inner.length);
      return hex(inner2.value)
        .replace(/(..)(?=.)/gu, '$1:')
        .toLowerCase();
    }
    if (oid === '2.5.29.32') {
      const outer = readTlv(inner, 0, inner.length);
      return childList(outer)
        .map((policy) => {
          const first = childList(policy)[0];
          return first === undefined ? '' : decodeOid(first.value);
        })
        .filter((value) => value !== '')
        .join(', ');
    }
    if (oid === '1.3.6.1.5.5.7.1.1') {
      const outer = readTlv(inner, 0, inner.length);
      return childList(outer)
        .map((description) => {
          const parts = childList(description);
          const method = parts[0] === undefined ? '' : decodeOid(parts[0].value);
          const location = parts[1] === undefined ? null : decodeGeneralName(parts[1]);
          return (
            (method === '1.3.6.1.5.5.7.48.1'
              ? 'OCSP'
              : method === '1.3.6.1.5.5.7.48.2'
                ? 'CA Issuers'
                : method) +
            ': ' +
            (location?.value ?? '')
          );
        })
        .join(', ');
    }
  } catch {
    return '0x' + hex(inner).slice(0, 60);
  }
  return '0x' + hex(inner).slice(0, 60);
}

interface SubjectField {
  oid: string;
  short: string;
  name: string;
  value: string;
}

interface CsrInfo {
  version: number;
  subject: SubjectField[];
  keyAlgorithmOid: string;
  keyAlgorithm: string;
  curveOid: string;
  curve: string;
  keyBits: number;
  signatureAlgorithmOid: string;
  signatureAlgorithm: string;
  signatureHex: string;
  extensions: Extension[];
  attributes: { oid: string; name: string; value: string }[];
  generalNames: GeneralName[];
  challengePassword: boolean;
  spki: Tlv;
  signature: Uint8Array;
  tbs: Uint8Array;
}

function parseCsr(der: Uint8Array): CsrInfo {
  const root = readTlv(der, 0, der.length);
  if (root.tag !== 0x30) {
    throw new DerError(
      'The outermost element is not a SEQUENCE, so this is not a PKCS#10 request.',
    );
  }
  const rootParts = childList(root);
  const info = expectTag(rootParts[0], 0x30, 'the request information');
  const signatureAlgorithm = expectTag(rootParts[1], 0x30, 'the signature algorithm');
  const signatureNode = expectTag(rootParts[2], 0x03, 'the signature');

  const infoParts = childList(info);
  const versionNode = expectTag(infoParts[0], 0x02, 'the version');
  const subjectNode = expectTag(infoParts[1], 0x30, 'the subject');
  const spkiNode = expectTag(infoParts[2], 0x30, 'the public key');
  const attributesNode = infoParts.find((node) => node.cls === 2 && (node.tag & 0x1f) === 0);

  const subject: SubjectField[] = [];
  for (const rdn of children(subjectNode)) {
    for (const attribute of children(rdn)) {
      const parts = childList(attribute);
      const oid = decodeOid(expectTag(parts[0], 0x06, 'an attribute type').value);
      const valueNode = parts[1];
      const known = DN_ATTRIBUTES.get(oid);
      subject.push({
        oid,
        short: known?.short ?? oid,
        name: known?.name ?? 'Unknown attribute',
        value: valueNode === undefined ? '' : decodeText(valueNode),
      });
    }
  }

  const spkiParts = childList(spkiNode);
  const keyAlgorithmNode = expectTag(spkiParts[0], 0x30, 'the key algorithm');
  const keyBitsNode = expectTag(spkiParts[1], 0x03, 'the public key');
  const keyAlgorithmParts = childList(keyAlgorithmNode);
  const keyAlgorithmOid = decodeOid(
    expectTag(keyAlgorithmParts[0], 0x06, 'the key algorithm OID').value,
  );
  const paramsNode = keyAlgorithmParts[1];
  const curveOid =
    paramsNode !== undefined && paramsNode.tag === 0x06 ? decodeOid(paramsNode.value) : '';
  const curveInfo = CURVES.get(curveOid);

  let keyBits = 0;
  const keyMaterial = keyBitsNode.value.subarray(1);
  if (keyAlgorithmOid === '1.2.840.113549.1.1.1') {
    try {
      const rsa = readTlv(keyMaterial, 0, keyMaterial.length);
      const modulus = childList(rsa)[0];
      if (modulus !== undefined) keyBits = integerBits(modulus.value);
    } catch {
      keyBits = 0;
    }
  } else if (curveInfo !== undefined) {
    keyBits = curveInfo.bits;
  } else if (keyAlgorithmOid === '1.3.101.112' || keyAlgorithmOid === '1.3.101.110') {
    keyBits = 256;
  } else if (keyAlgorithmOid === '1.3.101.113' || keyAlgorithmOid === '1.3.101.111') {
    keyBits = 448;
  }

  const sigAlgParts = childList(signatureAlgorithm);
  const signatureAlgorithmOid = decodeOid(
    expectTag(sigAlgParts[0], 0x06, 'the signature algorithm OID').value,
  );
  const signature = signatureNode.value.subarray(1);

  const extensions: Extension[] = [];
  const attributes: { oid: string; name: string; value: string }[] = [];
  let challengePassword = false;
  if (attributesNode !== undefined) {
    for (const attribute of children(attributesNode)) {
      const parts = childList(attribute);
      const oid = decodeOid(expectTag(parts[0], 0x06, 'an attribute OID').value);
      const setNode = parts[1];
      const values = setNode !== undefined && setNode.tag === 0x31 ? childList(setNode) : [];
      if (oid === '1.2.840.113549.1.9.14') {
        for (const request of values) {
          for (const extension of childList(request)) {
            const extensionParts = childList(extension);
            const extensionOid = decodeOid(
              expectTag(extensionParts[0], 0x06, 'an extension OID').value,
            );
            let index = 1;
            let critical = false;
            const maybeCritical = extensionParts[index];
            if (maybeCritical !== undefined && maybeCritical.tag === 0x01) {
              critical = (maybeCritical.value[0] ?? 0) !== 0;
              index += 1;
            }
            const extValue = extensionParts[index];
            const inner =
              extValue !== undefined && extValue.tag === 0x04 ? extValue.value : new Uint8Array(0);
            extensions.push({
              oid: extensionOid,
              name: EXTENSIONS.get(extensionOid) ?? 'Unknown extension',
              critical,
              decoded: decodeExtensionValue(extensionOid, inner),
            });
          }
        }
      } else if (oid === '1.2.840.113549.1.9.7') {
        challengePassword = true;
        attributes.push({ oid, name: 'challengePassword', value: 'set (value hidden)' });
      } else {
        attributes.push({
          oid,
          name: ATTRIBUTE_NAMES.get(oid) ?? 'Unknown attribute',
          value: clip(values.map((value) => '0x' + hex(value.value)).join(' '), 60),
        });
      }
    }
  }

  const sanExtension = extensions.find((extension) => extension.oid === '2.5.29.17');
  let generalNames: GeneralName[] = [];
  if (sanExtension !== undefined) {
    try {
      generalNames = sanitizeNames(extensionsRaw(der, extensions, sanExtension.oid));
    } catch {
      generalNames = [];
    }
  }

  return {
    version: integerValue(versionNode.value),
    subject,
    keyAlgorithmOid,
    keyAlgorithm: KEY_ALGORITHMS.get(keyAlgorithmOid) ?? 'Unknown (' + keyAlgorithmOid + ')',
    curveOid,
    curve: curveInfo?.name ?? (curveOid === '' ? '' : 'Unknown curve (' + curveOid + ')'),
    keyBits,
    signatureAlgorithmOid,
    signatureAlgorithm:
      SIGNATURE_ALGORITHMS.get(signatureAlgorithmOid) ?? 'Unknown (' + signatureAlgorithmOid + ')',
    signatureHex: hex(signature).slice(0, 64),
    extensions,
    attributes,
    generalNames,
    challengePassword,
    spki: spkiNode,
    signature,
    tbs: info.full,
  };
}

/** Re-walks the request to recover the raw SAN extension bytes for name listing. */
function extensionsRaw(der: Uint8Array, extensions: Extension[], targetOid: string): Uint8Array {
  const root = readTlv(der, 0, der.length);
  const info = expectTag(childList(root)[0], 0x30, 'the request information');
  const attributesNode = childList(info).find((node) => node.cls === 2 && (node.tag & 0x1f) === 0);
  if (attributesNode === undefined) return new Uint8Array(0);
  for (const attribute of children(attributesNode)) {
    const parts = childList(attribute);
    const oid = parts[0] === undefined ? '' : decodeOid(parts[0].value);
    if (oid !== '1.2.840.113549.1.9.14') continue;
    const setNode = parts[1];
    if (setNode === undefined) continue;
    for (const request of childList(setNode)) {
      for (const extension of childList(request)) {
        const extensionParts = childList(extension);
        const extensionOid =
          extensionParts[0] === undefined ? '' : decodeOid(extensionParts[0].value);
        if (extensionOid !== targetOid) continue;
        const valueNode = extensionParts.find((node) => node.tag === 0x04);
        if (valueNode !== undefined) return valueNode.value;
      }
    }
  }
  void extensions;
  return new Uint8Array(0);
}

async function sha256Fingerprint(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return '';
  try {
    const digest = await subtle.digest('SHA-256', new Uint8Array(bytes));
    return hex(new Uint8Array(digest))
      .replace(/(..)(?=.)/gu, '$1:')
      .toUpperCase();
  } catch {
    return '';
  }
}

/**
 * PKCS#10 stores an ECDSA signature as the DER-encoded ECDSA-Sig-Value (SEQUENCE { r, s }),
 * while WebCrypto expects the raw r||s pair padded to the curve width.
 */
function ecdsaSignatureToRaw(signature: Uint8Array, width: number): Uint8Array<ArrayBuffer> | null {
  if (width === 0) return null;
  if ((signature[0] ?? 0) !== 0x30)
    return signature.length === width * 2 ? new Uint8Array(signature) : null;
  try {
    const parts = childList(readTlv(signature, 0, signature.length));
    const r = parts[0];
    const s = parts[1];
    if (r === undefined || s === undefined) return null;
    const raw = new Uint8Array(width * 2);
    raw.set(padInteger(r.value, width), 0);
    raw.set(padInteger(s.value, width), width);
    return raw;
  } catch {
    return null;
  }
}

function padInteger(value: Uint8Array, width: number): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const bytes = value.subarray(start);
  if (bytes.length > width) throw new DerError('A signature integer is too large for the curve.');
  const out = new Uint8Array(width);
  out.set(bytes, width - bytes.length);
  return out;
}

async function verifyCsrSignature(info: CsrInfo): Promise<VerifyResult> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) return 'unavailable';
  const spki = new Uint8Array(info.spki.full);
  const signature = new Uint8Array(info.signature);
  const data = new Uint8Array(info.tbs);
  try {
    const rsaHash = RSA_SIGNATURE_HASHES.get(info.signatureAlgorithmOid);
    if (rsaHash !== undefined) {
      const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: rsaHash };
      const key = await subtle.importKey('spki', spki, algorithm, false, ['verify']);
      return (await subtle.verify(algorithm, key, signature, data)) ? 'valid' : 'invalid';
    }
    const ecdsaHash = ECDSA_SIGNATURE_HASHES.get(info.signatureAlgorithmOid);
    if (ecdsaHash !== undefined) {
      const curve = CURVES.get(info.curveOid);
      if (curve === undefined || curve.webcrypto === '') return 'unsupported';
      const importAlgorithm = { name: 'ECDSA', namedCurve: curve.webcrypto };
      const key = await subtle.importKey('spki', spki, importAlgorithm, false, ['verify']);
      const verifyAlgorithm = { name: 'ECDSA', hash: ecdsaHash };
      const raw = ecdsaSignatureToRaw(signature, Math.ceil(curve.bits / 8));
      if (raw === null) return 'unsupported';
      return (await subtle.verify(verifyAlgorithm, key, raw, data)) ? 'valid' : 'invalid';
    }
    if (info.signatureAlgorithmOid === '1.3.101.112') {
      const algorithm = { name: 'Ed25519' };
      const key = await subtle.importKey('spki', spki, algorithm, false, ['verify']);
      return (await subtle.verify(algorithm, key, signature, data)) ? 'valid' : 'invalid';
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

function decodeInput(text: string): { der: Uint8Array; source: string } {
  const pem = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/u.exec(text);
  let base64 = '';
  let source = 'DER';
  if (pem !== null) {
    const label = (pem[1] ?? '').trim();
    if (/REQUEST/u.test(label)) {
      source = 'PEM (' + label + ')';
    } else if (/CERTIFICATE/u.test(label)) {
      throw new ToolError(
        'That is a certificate, not a certificate request.',
        'Use the X.509 Certificate Inspector to decode a certificate, or paste the CSR that was signed.',
      );
    } else {
      throw new ToolError(
        'The PEM block is labelled "' + label + '".',
        'Expected CERTIFICATE REQUEST or NEW CERTIFICATE REQUEST.',
      );
    }
    base64 = (pem[2] ?? '').replace(/\s+/gu, '');
  } else {
    const compact = text.replace(/\s+/gu, '');
    if (/^[0-9a-f]+$/iu.test(compact) && compact.length % 2 === 0) {
      source = 'hex';
      const bytes = new Uint8Array(compact.length / 2);
      for (let i = 0; i < bytes.length; i += 1)
        bytes[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
      return { der: bytes, source };
    }
    base64 = compact;
  }

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { der: bytes, source };
  } catch {
    throw new ToolError(
      'That is not valid PEM, base64 or hex.',
      'Paste the whole block from -----BEGIN CERTIFICATE REQUEST----- to -----END CERTIFICATE REQUEST-----.',
    );
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'summary');
  const verifySignature = o.verifySignature !== false;

  const source = input.files[0];
  let text: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 1 MB.');
    text = await source.text();
  } else {
    text = String(input.text ?? '');
  }
  if (text.trim() === '')
    throw new ToolError('No certificate request was provided.', 'Paste a CSR in PEM or DER form.');
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 1 MB of input.');

  const { der, source: sourceLabel } = decodeInput(text);
  if (der.length === 0) throw new ToolError('No DER data was found in that input.');

  let info: CsrInfo;
  try {
    info = parseCsr(der);
  } catch (error) {
    const reason = error instanceof DerError ? error.message : 'The structure could not be read.';
    throw new ToolError('That is not a valid PKCS#10 certificate request.', reason);
  }

  const fingerprint = await sha256Fingerprint(der);
  const verifyResult: VerifyResult = verifySignature ? await verifyCsrSignature(info) : 'skipped';
  const commonName = info.subject.find((field) => field.oid === '2.5.4.3')?.value ?? '';
  const sanExtension = info.extensions.find((extension) => extension.oid === '2.5.29.17');
  const keyUsage = info.extensions.find((extension) => extension.oid === '2.5.29.15');
  const basicConstraints = info.extensions.find((extension) => extension.oid === '2.5.29.19');

  const findings: { level: 'error' | 'warning' | 'note'; problem: string; detail: string }[] = [];
  let findingsTruncated = false;
  if (verifyResult === 'invalid') {
    findings.push({
      level: 'error',
      problem: 'The signature does not match the key',
      detail:
        'The request was altered or corrupted after it was signed, so it must not be signed by a CA.',
    });
  }
  if (info.version !== 0) {
    findings.push({
      level: 'error',
      problem: 'Unsupported version ' + info.version,
      detail:
        'PKCS#10 defines only version 0; anything else is malformed or a different structure.',
    });
  }
  if (info.keyAlgorithm === 'RSA' && info.keyBits > 0 && info.keyBits < 2048) {
    findings.push({
      level: 'warning',
      problem: 'RSA key is only ' + info.keyBits + ' bits',
      detail: 'Public CAs and modern clients require at least 2048 bits.',
    });
  }
  if (/sha-?1/iu.test(info.signatureAlgorithm)) {
    findings.push({
      level: 'warning',
      problem: 'The signature uses SHA-1',
      detail: 'SHA-1 was removed from browser and CA policies because collisions are practical.',
    });
  }
  if (sanExtension === undefined && commonName !== '') {
    findings.push({
      level: 'warning',
      problem: 'No subjectAltName extension',
      detail:
        'Clients ignore the Common Name for hostname checks, so a request with only CN=' +
        clip(commonName, 40) +
        ' cannot be used for TLS.',
    });
  }
  if (sanExtension !== undefined) {
    const asDns = info.generalNames.filter(
      (name) => name.kind === 'DNS' && /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(name.value),
    );
    for (const name of asDns) {
      if (findings.length >= MAX_FINDINGS) {
        findingsTruncated = true;
        break;
      }
      findings.push({
        level: 'warning',
        problem: 'IP address stored as a dNSName',
        detail: name.value + ' belongs in an IP subjectAltName entry.',
      });
    }
  }
  if (commonName === '') {
    findings.push({
      level: 'warning',
      problem: 'No Common Name',
      detail: 'The subject has no CN; most CAs require one even when SANs are present.',
    });
  } else if (commonName.length > 64) {
    findings.push({
      level: 'warning',
      problem: 'Common Name is longer than 64 characters',
      detail: 'The CN field is limited to 64 characters and will be rejected or truncated.',
    });
  }
  if (basicConstraints !== undefined && basicConstraints.decoded.startsWith('CA=true')) {
    findings.push({
      level: 'warning',
      problem: 'The request asks to be a CA',
      detail: 'A public CA will refuse to issue a CA certificate from an ordinary request.',
    });
  }
  if (info.keyBits === 0 && info.keyAlgorithm !== 'RSA') {
    findings.push({
      level: 'note',
      problem: 'Key size could not be determined',
      detail: 'The algorithm is listed by OID: ' + info.keyAlgorithmOid + '.',
    });
  }
  if (info.curveOid !== '' && CURVES.get(info.curveOid) === undefined) {
    findings.push({
      level: 'note',
      problem: 'Unrecognised curve',
      detail: 'The curve OID ' + info.curveOid + ' is not in this tool\u2019s table.',
    });
  }
  if (info.attributes.length > 0) {
    findings.push({
      level: 'note',
      problem: 'Extra attributes are present',
      detail: info.attributes.map((attribute) => attribute.name).join(', ') + '.',
    });
  }
  if (info.challengePassword) {
    findings.push({
      level: 'note',
      problem: 'A challenge password is set',
      detail: 'Most CAs ignore it; the value is not shown here.',
    });
  }
  if (info.extensions.length === 0) {
    findings.push({
      level: 'note',
      problem: 'The request asks for no extensions',
      detail: 'The CA will choose the extensions itself.',
    });
  }
  for (const extension of info.extensions) {
    if (findings.length >= MAX_FINDINGS) {
      findingsTruncated = true;
      break;
    }
    if (extension.name === 'Unknown extension' && extension.critical) {
      findings.push({
        level: 'note',
        problem: 'Critical extension is not recognised',
        detail:
          extension.oid + ' is marked critical, so a CA must understand it or reject the request.',
      });
    }
  }
  for (const field of info.subject) {
    if (findings.length >= MAX_FINDINGS) {
      findingsTruncated = true;
      break;
    }
    if (field.name === 'Unknown attribute') {
      findings.push({
        level: 'note',
        problem: 'Unrecognised subject attribute',
        detail: field.oid + ' = ' + clip(field.value, 40) + '.',
      });
    }
  }
  if (verifyResult === 'unsupported') {
    findings.push({
      level: 'note',
      problem: 'The signature could not be checked here',
      detail:
        'WebCrypto does not support ' +
        info.signatureAlgorithm +
        ' in this browser; the request may still be valid.',
    });
  }
  if (verifyResult === 'unavailable') {
    findings.push({
      level: 'note',
      problem: 'No WebCrypto available to check the signature',
      detail: 'The fields were still decoded from the DER.',
    });
  }
  if (keyUsage === undefined && sanExtension !== undefined) {
    findings.push({
      level: 'note',
      problem: 'No keyUsage extension',
      detail: 'Some CAs expect an explicit keyUsage such as digitalSignature and keyEncipherment.',
    });
  }

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const shownFindings = findings.slice(0, MAX_FINDINGS);
  const droppedFindings = findings.length - shownFindings.length;

  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (!verifySignature) resultNotes.push('Signature verification was switched off.');
  if (fingerprint === '')
    resultNotes.push('A SHA-256 fingerprint needs WebCrypto, which is unavailable here.');
  if (errors > 0) resultWarnings.push(errors + ' problem(s) must be fixed before signing.');
  if (findingsTruncated) {
    resultNotes.push(
      'The findings list stops at ' + MAX_FINDINGS + ' entries; more problems were found.',
    );
  } else if (droppedFindings > 0) {
    resultNotes.push(
      'The findings list stops at ' +
        MAX_FINDINGS +
        ' entries; ' +
        droppedFindings +
        ' more were found.',
    );
  }

  const verifyLabel =
    verifyResult === 'valid'
      ? 'valid (signed by the key in this request)'
      : verifyResult === 'invalid'
        ? 'INVALID'
        : verifyResult === 'skipped'
          ? 'not checked'
          : verifyResult;

  const stats: Record<string, string | number> = {
    source: sourceLabel,
    derBytes: der.length,
    subjectFields: info.subject.length,
    extensions: info.extensions.length,
    sanEntries: info.generalNames.length,
    keyBits: info.keyBits,
    signature: verifyResult,
    errors,
    warnings,
  };

  if (info.subject.length > MAX_ROWS)
    resultNotes.push('Only the first ' + MAX_ROWS + ' subject fields are listed.');
  if (info.extensions.length > MAX_ROWS)
    resultNotes.push('Only the first ' + MAX_ROWS + ' extensions are listed.');

  if (format === 'subject') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Field', 'Short', 'Value'],
          rows:
            info.subject.length === 0
              ? [['-', '-', 'The subject is empty.']]
              : info.subject
                  .slice(0, MAX_ROWS)
                  .map((field) => [field.name, field.short, clip(field.value, 80)]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'extensions') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Extension', 'Critical', 'Value'],
          rows:
            info.extensions.length === 0
              ? [['-', '-', 'This request asks for no extensions.']]
              : info.extensions
                  .slice(0, MAX_ROWS)
                  .map((extension) => [
                    extension.name +
                      (extension.name === 'Unknown extension' ? ' (' + extension.oid + ')' : ''),
                    extension.critical ? 'yes' : 'no',
                    clip(extension.decoded, 120) || '(empty)',
                  ]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'findings') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Level', 'Problem', 'Detail'],
          rows:
            findings.length === 0
              ? [
                  [
                    'ok',
                    'Nothing to flag',
                    'The request looks consistent and no common pitfalls were found.',
                  ],
                ]
              : shownFindings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    [
      'Subject',
      clip(info.subject.map((field) => field.short + '=' + field.value).join(', '), 200) ||
        '(empty)',
    ],
    ['Common Name', commonName || 'n/a'],
    [
      'Subject alt names',
      info.generalNames.length === 0
        ? sanExtension === undefined
          ? 'none requested'
          : 'none parsed'
        : clip(info.generalNames.map((name) => name.kind + ':' + name.value).join(', '), 200),
    ],
    ['Key algorithm', info.keyAlgorithm],
    ['Key size', info.keyBits > 0 ? info.keyBits + ' bits' : 'unknown'],
    ['Curve', info.curve || 'n/a'],
    ['Signature algorithm', info.signatureAlgorithm],
    ['Signature check', verifyLabel],
    ['Requested extensions', String(info.extensions.length)],
    [
      'Attributes',
      info.attributes.length === 0
        ? 'none'
        : info.attributes.map((attribute) => attribute.name).join(', '),
    ],
    ['Version', String(info.version)],
    ['DER size', der.length + ' bytes'],
    ['SHA-256 fingerprint', fingerprint === '' ? 'n/a' : fingerprint],
    ['Errors', String(errors)],
    ['Warnings', String(warnings)],
    ['Notes', String(notes)],
  ];

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
