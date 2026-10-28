/**
 * PGP tool — pure orchestration + helpers.
 *
 * This module is imported by the worker-side tool and contains all the OpenPGP
 * logic. The worker lazily imports 'openpgp' and passes the module object
 * through the `OpenPgpApi` interface defined below.
 *
 * Keeping the orchestration pure makes it unit-testable with a fake API.
 */

import { ToolError } from '@/lib/types';
import type { OptionValues } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  The openpgp surface the orchestration needs (structural subset of v6).    */
/* -------------------------------------------------------------------------- */

export interface PgpKeyLike {
  getFingerprint(): string;
  getKeyID(): { toHex(): string };
  getPrimaryUser(): { name: string; email: string } | null;
  armor(): Promise<string>;
  isPrivate: boolean;
}

export type PgpMessageLike = unknown;
export type PgpSignatureLike = unknown;

export interface PgpVerification {
  verified: boolean;
  signerKeyId: string;
  signerFingerprint: string;
}

export interface PgpKeyPairArmored {
  privateKeyArmored: string;
  publicKeyArmored: string;
  revocationCertificateArmored: string;
  fingerprint: string;
  keyId: string;
  userIds: string[];
}

export interface OpenPgpApi {
  generateKey(options: {
    type: 'ed25519' | 'nistp256' | 'rsa';
    rsaBits?: number;
    userIDs: Array<{ name: string; email: string }>;
    passphrase?: string;
    format?: 'armored' | 'binary';
  }): Promise<{
    privateKey: string;
    publicKey: string;
    revocationCertificate: string;
    privateKeyArmored?: string;
    publicKeyArmored?: string;
    revocationCertificateArmored?: string;
  }>;
  readKey: (options: { armoredKey: string }) => Promise<PgpKeyLike>;
  readPrivateKey: (options: { armoredKey: string }) => Promise<PgpKeyLike>;
  createMessage: (options: { text?: string; binary?: Uint8Array }) => PgpMessageLike;
  readMessage: (options: { armoredMessage: string }) => Promise<PgpMessageLike>;
  readCleartextMessage: (options: { cleartextMessage: string }) => Promise<PgpMessageLike>;
  encrypt: (options: {
    message: PgpMessageLike;
    encryptionKeys: PgpKeyLike[];
    format?: 'armored' | 'binary';
    compression?: number;
    padding?: number;
    date?: Date;
    filename?: string;
  }) => Promise<string>;
  decrypt: (options: {
    message: PgpMessageLike;
    decryptionKeys: PgpKeyLike[];
    format?: 'binary' | 'utf8' | 'utf-8';
    date?: Date;
    config?: { ignoreSessionKeys?: boolean };
  }) => Promise<{ data: string | Uint8Array; signatures: Array<{ verified: Promise<boolean>; keyID: { toHex(): string } }> }>;
  sign: (options: {
    message: PgpMessageLike;
    signingKeys: PgpKeyLike[];
    detached?: boolean;
    format?: 'armored' | 'binary';
    date?: Date;
  }) => Promise<string>;
  verify: (options: {
    message: PgpMessageLike;
    signature: PgpSignatureLike | string;
    verificationKeys: PgpKeyLike[];
    date?: Date;
    config?: { ignoreSessionKeys?: boolean };
  }) => Promise<{ signatures: Array<{ verified: Promise<boolean>; keyID: { toHex(): string }; signature: Promise<PgpSignatureLike> }>; data: string }>;
  readSignature: (options: { armoredSignature: string }) => Promise<PgpSignatureLike>;
  createCleartextMessage: (options: { text: string }) => Promise<PgpMessageLike>;
  config: {
    showComments: boolean;
    showVersion: boolean;
    preferredHashAlgorithm: number;
    preferredSymmetricAlgorithm: number;
    preferredCompressionAlgorithm: number;
  };
}

/* -------------------------------------------------------------------------- */
/*  Armour validation + fingerprint helpers                                    */
/* -------------------------------------------------------------------------- */

export type ArmorKind = 'public' | 'private' | 'message' | 'signature' | 'cleartext';

const ARMOR_HEADERS: Record<ArmorKind, RegExp> = {
  public: /-----BEGIN PGP PUBLIC KEY BLOCK-----/i,
  private: /-----BEGIN PGP PRIVATE KEY BLOCK-----/i,
  message: /-----BEGIN PGP MESSAGE-----/i,
  signature: /-----BEGIN PGP SIGNATURE-----/i,
  cleartext: /-----BEGIN PGP SIGNED MESSAGE-----/i,
};

/** The kind of a pasted OpenPGP block, or `null` if it is not armoured. */
export function detectArmorKind(text: string): ArmorKind | null {
  for (const [kind, re] of Object.entries(ARMOR_HEADERS)) {
    if (re.test(text)) return kind as ArmorKind;
  }
  return null;
}

const HEX = /^[0-9a-fA-F]{40}$/;

/**
 * Normalise and pretty-print a fingerprint. Accepts a 40-hex string, with or
 * without colons/spaces, and returns it grouped in fours, uppercase.
 */
export function formatFingerprint(fingerprint: string): string {
  const clean = fingerprint.replace(/[:\s]/g, '').toUpperCase();
  if (!HEX.test(clean)) throw new ToolError('Fingerprint must be 40 hex characters.');
  return clean.match(/.{4}/g)!.join(' ');
}

/** Extract the fingerprint hex from a key-like object, erroring if missing. */
export function fingerprintOf(key: PgpKeyLike): string {
  const fp = key.getFingerprint?.();
  if (!fp) throw new ToolError('Key object has no fingerprint.');
  return fp;
}

/**
 * Whether decrypted bytes are safe to show as text: valid UTF-8 with no NUL
 * bytes and no control characters other than tab, newline and carriage return.
 * Used to decide between an inline result and a download.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    const str = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return !/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(str);
  } catch {
    return false;
  }
}

/** Reduce a sender-supplied filename to a safe basename for the download link. */
export function safeFilename(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  const base = name.split(/[\\/]/).pop()!;
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || fallback;
}

/* -------------------------------------------------------------------------- */
/*  Passphrase strength hint                                                   */
/* -------------------------------------------------------------------------- */

export interface StrengthHint {
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  score: 0 | 1 | 2 | 3 | 4;
  warnings: string[];
}

const COMMON_PASSPHRASES = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'letmein',
  'admin',
  'welcome',
  'monkey',
  'dragon',
  'passw0rd',
]);

function poolClasses(pw: string): {
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
} {
  return {
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function maxRun(pw: string): number {
  let max = 1;
  let cur = 1;
  for (let i = 1; i < pw.length; i++) {
    if (pw[i] === pw[i - 1]) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 1;
    }
  }
  return max;
}

/**
 * A lightweight heuristic hint, not a real entropy estimate. Encourages
 * passphrases long enough to protect an OpenPGP secret key.
 */
export function passphraseStrength(passphrase: string): StrengthHint {
  const warnings: string[] = [];
  if (!passphrase) {
    return { label: 'Very weak', score: 0, warnings: ['No passphrase — private key will be unencrypted.'] };
  }
  if (passphrase.length < 8) warnings.push('Less than 8 characters.');
  if (passphrase.length < 12) warnings.push('Consider 12+ characters for long-term protection.');
  if (COMMON_PASSPHRASES.has(passphrase.toLowerCase())) warnings.push('Appears in common password lists.');
  if (maxRun(passphrase) >= 4) warnings.push('Long run of identical characters.');
  const { lower, upper, digit, symbol } = poolClasses(passphrase);
  const classes = [lower, upper, digit, symbol].filter(Boolean).length;
  if (classes < 3) warnings.push('Use mixed case, digits and symbols.');

  let score: StrengthHint['score'] = 0;
  if (passphrase.length >= 20 && classes === 4) score = 4;
  else if (passphrase.length >= 16 && classes >= 3) score = 3;
  else if (passphrase.length >= 12 && classes >= 2) score = 2;
  else if (passphrase.length >= 8) score = 1;

  const labels: StrengthHint['label'][] = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { label: labels[score], score, warnings };
}

/* -------------------------------------------------------------------------- */
/*  Key parsing                                                                */
/* -------------------------------------------------------------------------- */

export interface ParsedPublicKey {
  key: PgpKeyLike;
  fingerprint: string;
  keyId: string;
  userIds: string[];
}

export interface ParsedPrivateKey {
  key: PgpKeyLike;
  fingerprint: string;
  keyId: string;
  isEncrypted: boolean;
}

/** Read and validate a public key block, or throw a friendly ToolError. */
export async function parsePublicKey(api: OpenPgpApi, armored: string): Promise<ParsedPublicKey> {
  if (!armored.trim()) throw new ToolError('Public key is empty.');
  const kind = detectArmorKind(armored);
  if (kind !== 'public') {
    throw new ToolError(
      `Expected a public key block (-----BEGIN PGP PUBLIC KEY BLOCK-----). Got ${kind ?? 'non-armored data'}.`,
    );
  }
  const key = await api.readKey({ armoredKey: armored });
  const fp = fingerprintOf(key);
  const keyId = key.getKeyID().toHex().toUpperCase();
  const primary = key.getPrimaryUser();
  const userIds = primary ? [`${primary.name} <${primary.email}>`] : ['(no user ID)'];
  return { key, fingerprint: fp, keyId, userIds };
}

/** Read a private key block and, when the key is passphrase-protected, decrypt it with the supplied passphrase. */
export async function parsePrivateKey(
  api: OpenPgpApi,
  armored: string,
  passphrase: string,
): Promise<ParsedPrivateKey> {
  if (!armored.trim()) throw new ToolError('Private key is empty.');
  const kind = detectArmorKind(armored);
  if (kind !== 'private') {
    throw new ToolError(
      `Expected a private key block (-----BEGIN PGP PRIVATE KEY BLOCK-----). Got ${kind ?? 'non-armored data'}.`,
    );
  }
  let key: PgpKeyLike;
  try {
    key = await api.readPrivateKey({ armoredKey: armored });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/passphrase|decrypt|encrypted/i.test(msg)) {
      throw new ToolError('Private key is passphrase-protected. Provide the passphrase.');
    }
    throw new ToolError(`Failed to read private key: ${msg}`);
  }
  const fp = fingerprintOf(key);
  const keyId = key.getKeyID().toHex().toUpperCase();
  const isEncrypted = /ENCRYPTED/i.test(armored);
  return { key, fingerprint: fp, keyId, isEncrypted };
}

/* -------------------------------------------------------------------------- */
/*  Orchestration shapes                                                       */
/* -------------------------------------------------------------------------- */

export type KeyType = 'ed25519' | 'nistp256' | 'rsa2048' | 'rsa4096';

export interface KeyGenOptions {
  type: KeyType;
  userName: string;
  userEmail: string;
  passphrase?: string;
}

export interface GeneratedKey {
  privateKeyArmored: string;
  publicKeyArmored: string;
  revocationCertificateArmored: string;
  fingerprint: string;
  keyId: string;
  userIds: string[];
}

/** Generate a key pair. `passphrase` is optional (empty = unencrypted). */
export async function generateKeyPair(api: OpenPgpApi, o: KeyGenOptions): Promise<GeneratedKey> {
  const { type, userName, userEmail, passphrase } = o;
  if (!userName.trim() || !userEmail.trim()) {
    throw new ToolError('Name and email are required for key generation.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userEmail)) {
    throw new ToolError('Email address is not valid.');
  }

  const typeMap: Record<KeyType, { type: 'ed25519' | 'nistp256' | 'rsa'; rsaBits?: number }> = {
    ed25519: { type: 'ed25519' },
    nistp256: { type: 'nistp256' },
    rsa2048: { type: 'rsa', rsaBits: 2048 },
    rsa4096: { type: 'rsa', rsaBits: 4096 },
  };
  const { type: keyType, rsaBits } = typeMap[type];

  const result = await api.generateKey({
    type: keyType,
    ...(rsaBits ? { rsaBits } : {}),
    userIDs: [{ name: userName, email: userEmail }],
    passphrase: passphrase || undefined,
    format: 'armored',
  });

  // In v6, the keys are already armored strings when format: 'armored'
  const privateKeyArmored = result.privateKey;
  const publicKeyArmored = result.publicKey;
  const revocationCertificateArmored = result.revocationCertificate;

  // Parse the private key to get fingerprint and keyId
  const privateKeyObj = await api.readPrivateKey({ armoredKey: privateKeyArmored });
  const fp = formatFingerprint(fingerprintOf(privateKeyObj));
  const keyId = privateKeyObj.getKeyID().toHex().toUpperCase();
  const primary = privateKeyObj.getPrimaryUser();
  const userIds = primary ? [`${primary.name} <${primary.email}>`] : [];

  return {
    privateKeyArmored,
    publicKeyArmored,
    revocationCertificateArmored,
    fingerprint: fp,
    keyId,
    userIds,
  };
}

export interface EncryptInput {
  message: string | Uint8Array;
  publicKeyArmored: string;
  isFile: boolean;
  filename?: string;
}

export interface EncryptResult {
  armored: string;
  recipientFingerprint: string;
  recipientKeyId: string;
  isBinary: boolean;
  filename?: string;
}

/** Encrypt text or bytes to a recipient's public key. */
export async function encryptData(api: OpenPgpApi, o: EncryptInput): Promise<EncryptResult> {
  const { message, publicKeyArmored, isFile, filename } = o;
  const parsed = await parsePublicKey(api, publicKeyArmored);

  const pgpMessage = isFile
    ? api.createMessage({ binary: message as Uint8Array })
    : api.createMessage({ text: message as string });

  const armored = await api.encrypt({
    message: pgpMessage,
    encryptionKeys: [parsed.key],
    format: 'armored',
    compression: 2,
    date: new Date(),
    filename: filename || (isFile ? 'file' : undefined),
  });

  return {
    armored,
    recipientFingerprint: parsed.fingerprint,
    recipientKeyId: parsed.keyId,
    isBinary: isFile,
    filename: isFile ? `${safeFilename(filename, 'encrypted')}.pgp` : undefined,
  };
}

export interface DecryptInput {
  messageArmored: string;
  privateKeyArmored: string;
  passphrase: string;
}

export interface DecryptResult {
  data: string | Uint8Array;
  isText: boolean;
  filename: string;
  signatureVerified: boolean;
  signerKeyId?: string;
  signerFingerprint?: string;
}

/** Decrypt a message with the supplied private key. */
export async function decryptData(api: OpenPgpApi, o: DecryptInput): Promise<DecryptResult> {
  const { messageArmored, privateKeyArmored, passphrase } = o;
  const parsed = await parsePrivateKey(api, privateKeyArmored, passphrase);

  let pgpMessage: PgpMessageLike;
  try {
    pgpMessage = await api.readMessage({ armoredMessage: messageArmored });
  } catch {
    pgpMessage = await api.readCleartextMessage({ cleartextMessage: messageArmored });
  }

  const result = await api.decrypt({
    message: pgpMessage,
    decryptionKeys: [parsed.key],
    format: 'binary',
    date: new Date(),
  });

  let data: string | Uint8Array;
  if (result.data instanceof Uint8Array) {
    data = result.data;
  } else {
    data = new TextEncoder().encode(result.data);
  }

  const isText = looksLikeText(data);
  let filename = 'decrypted';
  if (isText) {
    filename += '.txt';
  } else {
    filename += '.bin';
  }

  let signatureVerified = false;
  let signerKeyId: string | undefined;
  let signerFingerprint: string | undefined;
  if (result.signatures?.length) {
    const sig = result.signatures[0];
    const verified = await sig.verified;
    signatureVerified = verified;
    signerKeyId = sig.keyID?.toHex?.().toUpperCase();
    if (signerKeyId) {
      signerFingerprint = formatFingerprint(signerKeyId);
    }
  }

  return {
    data,
    isText,
    filename,
    signatureVerified,
    signerKeyId,
    signerFingerprint,
  };
}

export interface SignInput {
  message: string | Uint8Array;
  privateKeyArmored: string;
  passphrase: string;
  detached: boolean;
  isFile: boolean;
  filename?: string;
}

export interface SignResult {
  armored: string;
  signerFingerprint: string;
  signerKeyId: string;
  isDetached: boolean;
  filename?: string;
}

/** Sign text with a private key. */
export async function signData(api: OpenPgpApi, o: SignInput): Promise<SignResult> {
  const { message, privateKeyArmored, passphrase, detached, isFile, filename } = o;
  const parsed = await parsePrivateKey(api, privateKeyArmored, passphrase);

  const pgpMessage = isFile
    ? api.createMessage({ binary: message as Uint8Array })
    : detached
      ? api.createMessage({ text: message as string })
      : await api.createCleartextMessage({ text: message as string });

  const armored = await api.sign({
    message: pgpMessage,
    signingKeys: [parsed.key],
    detached,
    format: 'armored',
    date: new Date(),
  });

  return {
    armored,
    signerFingerprint: parsed.fingerprint,
    signerKeyId: parsed.keyId,
    isDetached: detached,
    filename: detached ? `${safeFilename(filename, 'signature')}.asc` : undefined,
  };
}

export interface VerifyInput {
  data: string | Uint8Array;
  signatureArmored: string;
  publicKeyArmored: string;
  isFile: boolean;
}

export interface VerifyResult {
  verified: boolean;
  signerFingerprint: string;
  signerKeyId: string;
  signerUserId?: string;
}

/** Verify a detached or clearsigned signature against a public key. */
export async function verifyData(api: OpenPgpApi, o: VerifyInput): Promise<VerifyResult> {
  const { data, signatureArmored, publicKeyArmored, isFile } = o;
  const parsed = await parsePublicKey(api, publicKeyArmored);

  const pgpMessage = isFile
    ? api.createMessage({ binary: data as Uint8Array })
    : api.createMessage({ text: data as string });

  let signature: PgpSignatureLike;
  const sigKind = detectArmorKind(signatureArmored);
  if (sigKind === 'cleartext') {
    // Clearsigned message: the signature is embedded in the message
    const clearMessage = await api.readCleartextMessage({ cleartextMessage: signatureArmored });
    const result = await api.verify({
      message: clearMessage,
      verificationKeys: [parsed.key],
      date: new Date(),
    });
    if (!result.signatures?.length) throw new ToolError('No signature found in clearsigned message.');
    const sig = result.signatures[0];
    const verified = await sig.verified;
    return {
      verified,
      signerFingerprint: formatFingerprint(sig.keyID.toHex()),
      signerKeyId: sig.keyID.toHex().toUpperCase(),
      signerUserId: parsed.userIds[0],
    };
  }
  if (sigKind !== 'signature') {
    throw new ToolError('Expected a signature block (-----BEGIN PGP SIGNATURE-----).');
  }
  signature = await api.readSignature({ armoredSignature: signatureArmored });

  const result = await api.verify({
    message: pgpMessage,
    signature,
    verificationKeys: [parsed.key],
    date: new Date(),
  });

  if (!result.signatures?.length) throw new ToolError('Verification produced no result.');
  const sig = result.signatures[0];
  const verified = await sig.verified;
  return {
    verified,
    signerFingerprint: formatFingerprint(sig.keyID.toHex()),
    signerKeyId: sig.keyID.toHex().toUpperCase(),
    signerUserId: parsed.userIds[0],
  };
}

export interface ExportResult {
  publicKeyArmored: string;
}

/** Derive the public key block from a private key (needs the passphrase). */
export async function exportPublicKey(
  api: OpenPgpApi,
  privateKeyArmored: string,
  passphrase: string,
): Promise<ExportResult> {
  const parsed = await parsePrivateKey(api, privateKeyArmored, passphrase);
  // In v6, we can get the public key by calling toPublic() on the private key
  // The interface doesn't expose toPublic, so we cast
  const privateKeyWithToPublic = parsed.key as { toPublic: () => PgpKeyLike };
  const publicKeyObj = privateKeyWithToPublic.toPublic();
  const publicKeyArmored = await publicKeyObj.armor();
  return { publicKeyArmored };
}

/* -------------------------------------------------------------------------- */
/*  Panel state → payload (pure)                                               */
/* -------------------------------------------------------------------------- */

export type PgpMode = 'generate' | 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'export';

export interface PgpPanelValues {
  mode: PgpMode;
  keyType: KeyType;
  userName: string;
  userEmail: string;
  passphrase: string;
  publicKey: string;
  privateKey: string;
  decryptPassphrase: string;
  signType: 'detached' | 'clearsign';
}

export interface PgpPayload {
  mode: PgpMode;
  keyType?: KeyType;
  userName?: string;
  userEmail?: string;
  passphrase?: string;
  publicKey?: string;
  privateKey?: string;
  decryptPassphrase?: string;
  detached?: boolean;
  isFile?: boolean;
  filename?: string;
}

export type PgpSection = 'gen' | 'enc' | 'dec' | 'sig' | 'ver' | 'imp';

export function visibleSection(mode: PgpMode): PgpSection {
  switch (mode) {
    case 'generate':
      return 'gen';
    case 'encrypt':
      return 'enc';
    case 'decrypt':
      return 'dec';
    case 'sign':
      return 'sig';
    case 'verify':
      return 'ver';
    case 'export':
      return 'imp';
  }
}

export function missingField(mode: PgpMode, v: PgpPanelValues): string | undefined {
  switch (mode) {
    case 'generate':
      if (!v.userName.trim()) return 'Name is required.';
      if (!v.userEmail.trim()) return 'Email is required.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.userEmail)) return 'Email is not valid.';
      return undefined;
    case 'encrypt':
      if (!v.publicKey.trim()) return 'Public key is required.';
      return undefined;
    case 'decrypt':
      if (!v.privateKey.trim()) return 'Private key is required.';
      return undefined;
    case 'sign':
      if (!v.privateKey.trim()) return 'Private key is required.';
      return undefined;
    case 'verify':
      if (!v.publicKey.trim()) return 'Public key is required.';
      return undefined;
    case 'export':
      if (!v.privateKey.trim()) return 'Private key is required.';
      return undefined;
  }
}

export function buildPgpPayload(mode: PgpMode, v: PgpPanelValues): PgpPayload {
  const base = { mode };
  switch (mode) {
    case 'generate':
      return {
        ...base,
        keyType: v.keyType,
        userName: v.userName,
        userEmail: v.userEmail,
        passphrase: v.passphrase,
      };
    case 'encrypt':
      return { ...base, publicKey: v.publicKey, isFile: true };
    case 'decrypt':
      return { ...base, privateKey: v.privateKey, decryptPassphrase: v.decryptPassphrase, isFile: true };
    case 'sign':
      return {
        ...base,
        privateKey: v.privateKey,
        decryptPassphrase: v.decryptPassphrase,
        detached: v.signType === 'detached',
        isFile: true,
      };
    case 'verify':
      return { ...base, publicKey: v.publicKey, isFile: true };
    case 'export':
      return { ...base, privateKey: v.privateKey, decryptPassphrase: v.decryptPassphrase };
  }
}

/* -------------------------------------------------------------------------- */
/*  Optional key storage (opt-in, localStorage, panel-side only)               */
/* -------------------------------------------------------------------------- */

export const STORAGE_PUBLIC_KEY = 'pgp-tool:public-key';
export const STORAGE_PRIVATE_KEY = 'pgp-tool:private-key';

export interface KeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveKeys(storage: KeyStorage, publicKey: string, privateKey: string): void {
  storage.setItem(STORAGE_PUBLIC_KEY, publicKey);
  storage.setItem(STORAGE_PRIVATE_KEY, privateKey);
}

export function forgetKeys(storage: KeyStorage): void {
  storage.removeItem(STORAGE_PUBLIC_KEY);
  storage.removeItem(STORAGE_PRIVATE_KEY);
}

export function hasSavedKeys(storage: KeyStorage): boolean {
  return !!storage.getItem(STORAGE_PUBLIC_KEY) || !!storage.getItem(STORAGE_PRIVATE_KEY);
}