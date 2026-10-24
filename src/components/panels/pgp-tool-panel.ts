/**
 * PGP tool — pure orchestration + helpers.
 *
 * Everything in this module is DOM-free and importable by the tool module and
 * by the panel. The real openpgp library is never imported here: every
 * cryptographic operation is driven through an injected `OpenPgpApi`, so unit
 * tests can pass a fake. `run()` in `pgp-tool.tool.ts` hands it the real
 * openpgp import, which the bundler splits into its own lazy chunk.
 *
 * Private keys live only in the user's browser. Nothing here persists keys,
 * reads localStorage or talks to the network.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  The openpgp surface the orchestration needs (structural subset of v6).    */
/* -------------------------------------------------------------------------- */

export interface PgpKeyLike {
  getFingerprint(): string;
  getUserIDs(): string[];
  getKeyID(): { toHex(): string };
  isPrivate(): boolean;
  isDecrypted(): boolean;
  armor(): string;
  toPublic(): Promise<PgpKeyLike>;
}

// Message / signature objects are opaque — we only pass them back to the API.
export type PgpMessageLike = unknown;
export type PgpSignatureLike = unknown;

export interface PgpVerification {
  keyID: { toHex(): string };
  verified: Promise<true>;
}

export interface PgpKeyPairArmored {
  privateKey: string;
  publicKey: string;
  revocationCertificate: string;
}

export interface OpenPgpApi {
  generateKey(o: {
    userIDs: { name?: string; email?: string }[];
    type: string;
    curve?: string;
    rsaBits?: number;
    passphrase?: string;
    format: 'armored';
  }): Promise<PgpKeyPairArmored>;
  readKey(o: { armoredKey: string }): Promise<PgpKeyLike>;
  readPrivateKey(o: { armoredKey: string }): Promise<PgpKeyLike>;
  decryptKey(o: { privateKey: PgpKeyLike; passphrase: string }): Promise<PgpKeyLike>;
  readMessage(o: { armoredMessage?: string; binaryMessage?: Uint8Array }): Promise<PgpMessageLike>;
  createMessage(o: {
    text?: string;
    binary?: Uint8Array;
    filename?: string;
  }): Promise<PgpMessageLike>;
  readSignature(o: { armoredSignature: string }): Promise<PgpSignatureLike>;
  createCleartextMessage(o: { text: string }): Promise<PgpMessageLike>;
  readCleartextMessage(o: { cleartextMessage: string }): Promise<PgpMessageLike>;
  encrypt(o: {
    message: PgpMessageLike;
    encryptionKeys: PgpKeyLike | PgpKeyLike[];
    format: 'armored' | 'binary';
  }): Promise<string | Uint8Array>;
  decrypt(o: {
    message: PgpMessageLike;
    decryptionKeys: PgpKeyLike | PgpKeyLike[];
    format?: 'utf8' | 'binary';
  }): Promise<{ data: string | Uint8Array; signatures: PgpVerification[] }>;
  sign(o: {
    message: PgpMessageLike;
    signingKeys: PgpKeyLike | PgpKeyLike[];
    detached?: boolean;
    format: 'armored';
  }): Promise<string>;
  verify(o: {
    message: PgpMessageLike;
    verificationKeys: PgpKeyLike | PgpKeyLike[];
    signature?: PgpSignatureLike;
    format?: 'utf8' | 'binary';
  }): Promise<{ data: string | Uint8Array; signatures: PgpVerification[] }>;
}

/* -------------------------------------------------------------------------- */
/*  Armour validation + fingerprint helpers                                    */
/* -------------------------------------------------------------------------- */

/** Marker for each kind of ASCII armoured OpenPGP block we understand. */
export type ArmorKind = 'public' | 'private' | 'message' | 'signature' | 'cleartext';

const ARMOR_HEADERS: Record<ArmorKind, RegExp> = {
  public: /-----BEGIN PGP PUBLIC KEY BLOCK-----/,
  private: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
  message: /-----BEGIN PGP MESSAGE-----/,
  signature: /-----BEGIN PGP SIGNATURE-----/,
  cleartext: /-----BEGIN PGP SIGNED MESSAGE-----/,
};

/** The kind of a pasted OpenPGP block, or `null` if it is not armoured. */
export function detectArmorKind(text: string): ArmorKind | null {
  const trimmed = text.trim();
  for (const kind of Object.keys(ARMOR_HEADERS) as ArmorKind[]) {
    if (ARMOR_HEADERS[kind]!.test(trimmed)) return kind;
  }
  return null;
}

const HEX = /^[0-9a-fA-F]{40}$/;

/**
 * Normalise and pretty-print a fingerprint. Accepts a 40-hex string, with or
 * without colons/spaces, and returns it grouped in fours, uppercase.
 */
export function formatFingerprint(fingerprint: string): string {
  const hex = fingerprint.replace(/[^0-9a-fA-F]/g, '');
  if (!HEX.test(hex)) return fingerprint;
  return hex
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join(' ');
}

/** Extract the fingerprint hex from a key-like object, erroring if missing. */
export function fingerprintOf(key: PgpKeyLike): string {
  try {
    const fp = key.getFingerprint();
    if (!fp) throw new Error('empty');
    return fp;
  } catch {
    throw new ToolError('Could not read the fingerprint from that key.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Passphrase strength hint                                                   */
/* -------------------------------------------------------------------------- */

export interface StrengthHint {
  /** 0 (very weak) … 4 (strong). */
  score: number;
  label: string;
  suggestion: string;
}

const COMMON_PASSPHRASES = new Set([
  'password',
  'password1',
  '123456',
  '12345678',
  'letmein',
  'qwerty',
  'iloveyou',
  'monkey',
  'dragon',
  'welcome',
  'sunshine',
  'princess',
  'admin',
  'test',
  'master',
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
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function maxRun(pw: string): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < pw.length; i++) {
    if (pw.charCodeAt(i) === pw.charCodeAt(i - 1) + 1 || pw[i] === pw[i - 1]) run += 1;
    else run = 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * A lightweight heuristic hint, not a real entropy estimate. Encourages
 * passphrases long enough to protect an OpenPGP secret key.
 */
export function passphraseStrength(passphrase: string): StrengthHint {
  const pw = passphrase.trim();
  if (!pw) return { score: 0, label: 'Missing', suggestion: 'Enter a passphrase.' };

  let score = 0;
  const len = pw.length;

  if (len >= 8) score += 1;
  if (len >= 14) score += 1;

  const c = poolClasses(pw);
  const variety = [c.lower, c.upper, c.digit, c.symbol].filter(Boolean).length;
  if (variety >= 3) score += 1;
  if (maxRun(pw) <= 3 && len >= 10) score += 1;
  if (COMMON_PASSPHRASES.has(pw.toLowerCase())) score = Math.min(score, 1);
  score = Math.max(0, Math.min(4, score));

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const suggestions = [
    'Use at least 8 characters.',
    'Use at least 14 characters.',
    'Mix letters, numbers and symbols.',
    'Avoid repeated or sequential characters.',
    'A long passphrase beats a short complex one.',
  ];
  return { score, label: labels[score]!, suggestion: suggestions[score]! };
}

/* -------------------------------------------------------------------------- */
/*  Key parsing                                                                */
/* -------------------------------------------------------------------------- */

export interface ParsedPublicKey {
  fingerprint: string;
  formattedFingerprint: string;
  keyID: string;
  userIDs: string[];
  armored: string;
}

/** Read and validate a public key block, or throw a friendly ToolError. */
export async function parsePublicKey(api: OpenPgpApi, armored: string): Promise<ParsedPublicKey> {
  const block = armored.trim();
  const kind = detectArmorKind(block);
  if (!kind || (kind !== 'public' && kind !== 'private')) {
    throw new ToolError(
      'That is not an OpenPGP public key block.',
      'Paste the whole "-----BEGIN PGP PUBLIC KEY BLOCK-----" armour.',
    );
  }
  let key: PgpKeyLike;
  try {
    key = await api.readKey({ armoredKey: block });
  } catch {
    throw new ToolError('That block could not be parsed as a public key.');
  }
  if (key.isPrivate()) {
    throw new ToolError(
      'That looks like a private key.',
      'Export the public key from your key management and paste it here instead.',
    );
  }
  const fingerprint = fingerprintOf(key);
  return {
    fingerprint,
    formattedFingerprint: formatFingerprint(fingerprint),
    keyID: key.getKeyID().toHex(),
    userIDs: key.getUserIDs(),
    armored: block,
  };
}

export interface ParsedPrivateKey {
  fingerprint: string;
  formattedFingerprint: string;
  keyID: string;
  userIDs: string[];
  /** The decrypted key, ready for decrypt/sign. */
  privateKey: PgpKeyLike;
}

/**
 * Read a private key block and, when the key is passphrase-protected, decrypt
 * it with the supplied passphrase. Errors are surfaced with actionable hints.
 */
export async function parsePrivateKey(
  api: OpenPgpApi,
  armored: string,
  passphrase: string,
): Promise<ParsedPrivateKey> {
  const block = armored.trim();
  if (detectArmorKind(block) !== 'private') {
    throw new ToolError(
      'That is not an OpenPGP private key block.',
      'Paste the whole "-----BEGIN PGP PRIVATE KEY BLOCK-----" armour.',
    );
  }
  let key: PgpKeyLike;
  try {
    key = await api.readPrivateKey({ armoredKey: block });
  } catch {
    throw new ToolError('That block could not be parsed as a private key.');
  }

  if (!key.isDecrypted()) {
    if (!passphrase) {
      throw new ToolError(
        'This private key is protected by a passphrase.',
        'Enter the passphrase you chose when the key was created.',
      );
    }
    try {
      key = await api.decryptKey({ privateKey: key, passphrase });
    } catch {
      throw new ToolError('The passphrase did not unlock this private key.');
    }
  }

  return {
    fingerprint: fingerprintOf(key),
    formattedFingerprint: formatFingerprint(fingerprintOf(key)),
    keyID: key.getKeyID().toHex(),
    userIDs: key.getUserIDs(),
    privateKey: key,
  };
}

/* -------------------------------------------------------------------------- */
/*  Orchestration shapes                                                       */
/* -------------------------------------------------------------------------- */

export type KeyType = 'ed25519' | 'nistp256' | 'rsa2048' | 'rsa4096';

export interface KeyGenOptions {
  keyType: KeyType;
  name: string;
  email: string;
  passphrase: string;
}

export interface GeneratedKey {
  privateKey: string;
  publicKey: string;
  revocationCertificate: string;
  fingerprint: string;
  formattedFingerprint: string;
  keyID: string;
  userIDs: string[];
}

/** Generate a key pair. `passphrase` is optional (empty = unencrypted). */
export async function generateKeyPair(api: OpenPgpApi, o: KeyGenOptions): Promise<GeneratedKey> {
  const passphrase = o.passphrase.trim();
  const userIDs = [{ name: o.name.trim() || undefined, email: o.email.trim() || undefined }];
  if (!userIDs[0]!.name && !userIDs[0]!.email) {
    throw new ToolError('Give the key a name or an email address.');
  }

  let type: string;
  let curve: string | undefined;
  let rsaBits: number | undefined;
  switch (o.keyType) {
    case 'nistp256':
      type = 'ecc';
      curve = 'nistP256';
      break;
    case 'rsa2048':
      type = 'rsa';
      rsaBits = 2048;
      break;
    case 'rsa4096':
      type = 'rsa';
      rsaBits = 4096;
      break;
    case 'ed25519':
    default:
      type = 'ecc';
      curve = 'curve25519';
      break;
  }

  let pair: PgpKeyPairArmored;
  try {
    pair = await api.generateKey({
      userIDs,
      type,
      curve,
      rsaBits,
      passphrase: passphrase || undefined,
      format: 'armored',
    });
  } catch {
    throw new ToolError('Key generation failed in this browser.');
  }

  const key = await api.readPrivateKey({ armoredKey: pair.privateKey });
  const fingerprint = fingerprintOf(key);
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    revocationCertificate: pair.revocationCertificate,
    fingerprint,
    formattedFingerprint: formatFingerprint(fingerprint),
    keyID: key.getKeyID().toHex(),
    userIDs: key.getUserIDs(),
  };
}

export interface EncryptInput {
  /** Plain text (when no binary payload is given). */
  text?: string;
  /** Raw bytes to encrypt (takes precedence over `text`). */
  binary?: Uint8Array;
  /** Filename hint for a binary payload. */
  filename?: string;
  publicKeyArmor: string;
  output: 'armored' | 'binary';
}

export interface EncryptResult {
  /** Armored ciphertext, when `output === 'armored'`. */
  armored?: string;
  /** Raw ciphertext, when `output === 'binary'`. */
  binary?: Uint8Array;
  fingerprint: string;
  userIDs: string[];
}

/** Encrypt text or bytes to a recipient's public key. */
export async function encryptData(api: OpenPgpApi, o: EncryptInput): Promise<EncryptResult> {
  const { armored, fingerprint, userIDs } = await parsePublicKey(api, o.publicKeyArmor);
  if (!o.text && !o.binary) {
    throw new ToolError('Enter a message to encrypt.');
  }

  const message = await api.createMessage(
    o.binary
      ? { binary: o.binary, filename: o.filename ?? 'data.bin' }
      : { text: o.text! },
  );

  const result = await api.encrypt({
    message,
    encryptionKeys: await api.readKey({ armoredKey: armored }),
    format: o.output === 'binary' ? 'binary' : 'armored',
  });

  if (o.output === 'binary' && result instanceof Uint8Array) {
    return { binary: result, fingerprint, userIDs };
  }
  return { armored: String(result), fingerprint, userIDs };
}

export interface DecryptInput {
  /** Armored ciphertext. */
  armored?: string;
  /** Raw ciphertext. */
  binary?: Uint8Array;
  privateKeyArmor: string;
  passphrase: string;
  /** When true, request binary output (for binary messages). */
  binaryOutput?: boolean;
}

export interface DecryptResult {
  text?: string;
  binary?: Uint8Array;
  filename?: string;
  /** Verified signatures (empty when the message was not signed). */
  signatures: PgpVerification[];
}

/** Decrypt a message with the supplied private key. */
export async function decryptData(api: OpenPgpApi, o: DecryptInput): Promise<DecryptResult> {
  if (!o.armored && !o.binary) {
    throw new ToolError('Paste the encrypted message to decrypt.');
  }
  const { privateKey } = await parsePrivateKey(api, o.privateKeyArmor, o.passphrase);

  let message: PgpMessageLike;
  try {
    message = o.binary
      ? await api.readMessage({ binaryMessage: o.binary })
      : await api.readMessage({ armoredMessage: o.armored! });
  } catch {
    throw new ToolError(
      'That is not a valid OpenPGP message.',
      'Paste the whole "-----BEGIN PGP MESSAGE-----" block, or a binary .pgp/.gpg file.',
    );
  }

  let out: { data: string | Uint8Array; signatures: PgpVerification[] };
  try {
    out = await api.decrypt({
      message,
      decryptionKeys: privateKey,
      format: o.binaryOutput ? 'binary' : 'utf8',
    });
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(
      'Could not decrypt the message.',
      'Check the private key and passphrase, and that the message was encrypted to this key.',
    );
  }

  const data = out.data;
  if (o.binaryOutput || data instanceof Uint8Array) {
    return {
      binary: data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)),
      signatures: out.signatures,
    };
  }
  return { text: String(data), signatures: out.signatures };
}

export interface SignInput {
  /** Text to sign (used for both detached and clearsigned signatures). */
  text: string;
  privateKeyArmor: string;
  passphrase: string;
  /** `detached` = ASCII-armored signature block; `clearsign` = signed text. */
  style: 'detached' | 'clearsign';
}

export interface SignResult {
  /** Detached signature armour (style `detached`). */
  signatureArmor?: string;
  /** Clearsigned text (style `clearsign`). */
  clearsigned?: string;
  fingerprint: string;
  userIDs: string[];
}

/** Sign text with a private key. */
export async function signData(api: OpenPgpApi, o: SignInput): Promise<SignResult> {
  if (!o.text) throw new ToolError('Enter the text to sign.');
  const { privateKey, fingerprint, userIDs } = await parsePrivateKey(
    api,
    o.privateKeyArmor,
    o.passphrase,
  );

  if (o.style === 'clearsign') {
    const message = await api.createCleartextMessage({ text: o.text });
    const armored = await api.sign({ message, signingKeys: privateKey, format: 'armored' });
    return { clearsigned: armored, fingerprint, userIDs };
  }

  const message = await api.createMessage({ text: o.text });
  const signatureArmor = await api.sign({
    message,
    signingKeys: privateKey,
    detached: true,
    format: 'armored',
  });
  return { signatureArmor, fingerprint, userIDs };
}

export interface VerifyInput {
  /** The signed text or message. */
  text?: string;
  binary?: Uint8Array;
  /** Detached signature armour (optional for clearsigned messages). */
  signatureArmor?: string;
  publicKeyArmor: string;
}

export interface VerifyResult {
  valid: boolean;
  keyID: string;
  fingerprint: string;
  userIDs: string[];
  /** Whether a signature was present at all. */
  signed: boolean;
}

/** Verify a detached or clearsigned signature against a public key. */
export async function verifyData(api: OpenPgpApi, o: VerifyInput): Promise<VerifyResult> {
  const { fingerprint, userIDs, armored } = await parsePublicKey(api, o.publicKeyArmor);

  if (!o.text && !o.binary) {
    throw new ToolError('Paste the signed text or message to verify.');
  }
  if (!o.signatureArmor) {
    if (!o.text || detectArmorKind(o.text) !== 'cleartext') {
      throw new ToolError(
        'No signature to verify.',
        'Paste the detached signature, or a "-----BEGIN PGP SIGNED MESSAGE-----" block.',
      );
    }
  }

  const key = await api.readKey({ armoredKey: armored });

  let verification: { signatures: PgpVerification[] };
  if (o.signatureArmor) {
    const message = o.binary
      ? await api.createMessage({ binary: o.binary })
      : await api.createMessage({ text: o.text! });
    const signature = await api.readSignature({ armoredSignature: o.signatureArmor.trim() });
    verification = await api.verify({ message, verificationKeys: key, signature });
  } else {
    const message = await api.readCleartextMessage({ cleartextMessage: o.text!.trim() });
    verification = await api.verify({ message, verificationKeys: key });
  }

  let valid = false;
  let signerKeyID = '';
  for (const sig of verification.signatures) {
    signerKeyID = sig.keyID.toHex();
    try {
      await sig.verified;
      valid = true;
      break;
    } catch {
      // try the next signature (e.g. a subkey)
    }
  }
  if (!valid) {
    throw new ToolError(
      'The signature is not valid for this message and key.',
      'Check that you pasted the matching message, signature and public key.',
    );
  }
  return { valid: true, keyID: signerKeyID, fingerprint, userIDs, signed: true };
}

export interface ExportResult {
  publicKey: string;
  fingerprint: string;
  formattedFingerprint: string;
  keyID: string;
  userIDs: string[];
}

/** Derive the public key block from a private key (needs the passphrase). */
export async function exportPublicKey(
  api: OpenPgpApi,
  privateKeyArmor: string,
  passphrase: string,
): Promise<ExportResult> {
  const { privateKey, fingerprint, formattedFingerprint, keyID, userIDs } = await parsePrivateKey(
    api,
    privateKeyArmor,
    passphrase,
  );
  const publicKey = (await privateKey.toPublic()).armor();
  return { publicKey, fingerprint, formattedFingerprint, keyID, userIDs };
}