import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pgp-tool.meta';
import {
  buildPgpPayload,
  decryptData,
  encryptData,
  exportPublicKey,
  generateKeyPair,
  missingField,
  parsePrivateKey,
  parsePublicKey,
  signData,
  verifyData,
  type OpenPgpApi,
  type PgpMode,
  type PgpPayload,
} from './pgp-tool-panel';

/**
 * The PGP tool. openpgp.js is imported lazily here — the module is only loaded
 * when the tool runs, so the bundler splits the library into its own chunk.
 * All heavy crypto runs in the Web Worker (file tools run there by default),
 * keeping the UI thread free.
 *
 * The real openpgp import is cast to the structural `OpenPgpApi` the pure
 * orchestration in `pgp-tool-panel.ts` needs; all behaviour lives there and is
 * unit-tested against a fake.
 */

/** Lazily-loaded openpgp module, fetched only when `run()` first needs it. */
let apiPromise: Promise<OpenPgpApi> | undefined;
let loadApiError: Error | undefined;

async function loadApi(): Promise<OpenPgpApi> {
  if (loadApiError) throw loadApiError;
  if (!apiPromise) {
    apiPromise = import('openpgp')
      .then((m) => {
        console.log('[pgp-tool] openpgp loaded successfully');
        return m as unknown as OpenPgpApi;
      })
      .catch((e: Error) => {
        console.error('[pgp-tool] openpgp import failed:', e.message);
        loadApiError = new ToolError('OpenPGP support requires the "openpgp" package, which is not installed. This tool is currently unavailable.');
        throw loadApiError;
      });
  }
  return apiPromise;
}

/** Mode dispatch is driven by the panel, mirrored by the generic workbench. */
type Mode = 'generate' | 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'export';

function normalizeMode(value: string): Mode {
  const v = value.toLowerCase();
  const allowed: Mode[] = ['generate', 'encrypt', 'decrypt', 'sign', 'verify', 'export'];
  if (allowed.includes(v as Mode)) return v as Mode;
  throw new ToolError(`Unknown mode: ${value}`);
}

/** Read a dropped file's bytes, or return undefined when none was chosen. */
async function readFileBytes(input: FileRunInput): Promise<Uint8Array | undefined> {
  if (input.files.length === 0) return undefined;
  const file = input.files[0];
  return new Uint8Array(await file.arrayBuffer());
}

export async function run(input: FileRunInput): Promise<FileRunResult> {
  const { options, signal, onProgress } = input;

  // Resolve options through the shared resolver (panel mirrors these keys).
  const resolved = resolveOptions(meta, options);

  // Validate mode presence.
  const mode = normalizeMode(String(resolved.mode ?? 'generate'));
  const payload = buildPgpPayload(mode, {
    mode,
    keyType: String(resolved.keyType ?? 'ed25519') as 'ed25519' | 'nistp256' | 'rsa2048' | 'rsa4096',
    userName: String(resolved.userName ?? ''),
    userEmail: String(resolved.userEmail ?? ''),
    passphrase: String(resolved.passphrase ?? ''),
    publicKey: String(resolved.publicKey ?? ''),
    privateKey: String(resolved.privateKey ?? ''),
    decryptPassphrase: String(resolved.decryptPassphrase ?? ''),
    signType: String(resolved.signType ?? 'detached') as 'detached' | 'clearsign',
  } as Parameters<typeof buildPgpPayload>[1]);

  // Early field validation (mirrors panel hints).
  const missing = missingField(mode, {
    mode,
    keyType: String(resolved.keyType ?? 'ed25519') as 'ed25519' | 'nistp256' | 'rsa2048' | 'rsa4096',
    userName: String(resolved.userName ?? ''),
    userEmail: String(resolved.userEmail ?? ''),
    passphrase: String(resolved.passphrase ?? ''),
    publicKey: String(resolved.publicKey ?? ''),
    privateKey: String(resolved.privateKey ?? ''),
    decryptPassphrase: String(resolved.decryptPassphrase ?? ''),
    signType: String(resolved.signType ?? 'detached') as 'detached' | 'clearsign',
  } as Parameters<typeof missingField>[1]);
  if (missing) throw new ToolError(missing);

  const api = await loadApi();
  onProgress?.(0.1, 'Loading OpenPGP…');

  const outputs: FileRunResult['outputs'] = [];
  const warnings: string[] = [];
  const stats: Record<string, string | number> = { mode };
  let report: FileRunResult['report'] | undefined;

  try {
    switch (mode) {
      case 'generate': {
        onProgress?.(0.2, 'Generating key pair…');
        const result = await generateKeyPair(api, {
          type: payload.keyType!,
          userName: payload.userName!,
          userEmail: payload.userEmail!,
          passphrase: payload.passphrase || undefined,
        });
        onProgress?.(0.9, 'Done');

        outputs.push(
          {
            filename: 'private-key.asc',
            blob: new Blob([result.privateKeyArmored], { type: 'application/pgp-keys' }),
          },
          {
            filename: 'public-key.asc',
            blob: new Blob([result.publicKeyArmored], { type: 'application/pgp-keys' }),
          },
          {
            filename: 'revocation-certificate.asc',
            blob: new Blob([result.revocationCertificateArmored], { type: 'application/pgp-keys' }),
          },
        );

        report = {
          output: JSON.stringify({
            privateKeyArmored: result.privateKeyArmored,
            publicKeyArmored: result.publicKeyArmored,
            revocationCertificateArmored: result.revocationCertificateArmored,
            fingerprint: result.fingerprint,
            keyId: result.keyId,
            userIds: result.userIds,
          }),
          render: 'code',
        };
        stats.fingerprint = result.fingerprint;
        stats.keyId = result.keyId;
        stats.keyType = payload.keyType!;

        if (!payload.passphrase) {
          warnings.push('⚠️ Private key is unencrypted (no passphrase). Anyone with the file can use it.');
        }
        break;
      }

      case 'encrypt': {
        onProgress?.(0.2, 'Encrypting…');
        const fileBytes = await readFileBytes(input);
        const message = fileBytes ?? (input.text ?? '');
        const isFile = fileBytes !== undefined;
        const filename = input.files[0]?.name;

        const result = await encryptData(api, {
          message,
          publicKeyArmored: payload.publicKey!,
          isFile,
          filename,
        });
        onProgress?.(0.9, 'Done');

        outputs.push({
          filename: result.filename ?? 'message.asc',
          blob: new Blob([result.armored], { type: 'application/pgp-encrypted' }),
        });

        report = {
          output: JSON.stringify({
            armored: result.armored,
            recipientFingerprint: result.recipientFingerprint,
            recipientKeyId: result.recipientKeyId,
            isBinary: result.isBinary,
          }),
          render: 'code',
        };

        stats.recipientFingerprint = result.recipientFingerprint;
        stats.recipientKeyId = result.recipientKeyId;
        break;
      }

      case 'decrypt': {
        onProgress?.(0.2, 'Decrypting…');
        const fileBytes = await readFileBytes(input);
        const messageArmored = fileBytes
          ? new TextDecoder().decode(fileBytes)
          : input.text ?? '';
        if (!messageArmored.trim()) throw new ToolError('No encrypted message or file provided.');

        const result = await decryptData(api, {
          messageArmored,
          privateKeyArmored: payload.privateKey!,
          passphrase: payload.decryptPassphrase || '',
        });
        onProgress?.(0.9, 'Done');
        const isText = result.isText;
        const dataForBlob = typeof result.data === 'string' ? new TextEncoder().encode(result.data) : result.data;
        const blob = new Blob([dataForBlob], { type: isText ? 'text/plain' : 'application/octet-stream' });
        outputs.push({ filename: result.filename, blob });

        if (isText) {
          report = {
            output: new TextDecoder().decode(result.data),
            render: 'text',
          };
        } else {
          report = {
            output: JSON.stringify({
              filename: result.filename,
              size: result.data.byteLength,
              signatureVerified: result.signatureVerified,
              signerKeyId: result.signerKeyId,
              signerFingerprint: result.signerFingerprint,
            }),
            render: 'code',
          };
        }
        stats.signatureVerified = String(result.signatureVerified);
        if (result.signatureVerified) {
          stats.signerKeyId = result.signerKeyId;
          stats.signerFingerprint = result.signerFingerprint;
        }
        break;
      }

      case 'sign': {
        onProgress?.(0.2, 'Signing…');
        const fileBytes = await readFileBytes(input);
        const message = fileBytes ?? (input.text ?? '');
        const isFile = fileBytes !== undefined;
        const filename = input.files[0]?.name;

        const result = await signData(api, {
          message,
          privateKeyArmored: payload.privateKey!,
          passphrase: payload.decryptPassphrase || '',
          detached: payload.detached ?? true,
          isFile,
          filename,
        });
        onProgress?.(0.9, 'Done');

        outputs.push({
          filename: result.filename ?? (payload.detached ? 'signature.asc' : 'signed-message.asc'),
          blob: new Blob([result.armored], { type: 'application/pgp-signature' }),
        });

        report = {
          output: JSON.stringify({
            armored: result.armored,
            signerFingerprint: result.signerFingerprint,
            signerKeyId: result.signerKeyId,
            isDetached: result.isDetached,
          }),
          render: 'code',
        };
        stats.signerFingerprint = result.signerFingerprint;
        stats.signerKeyId = result.signerKeyId;
        stats.isDetached = String(result.isDetached);
        break;
      }

      case 'verify': {
        onProgress?.(0.2, 'Verifying…');
        const fileBytes = await readFileBytes(input);
        const data = fileBytes ?? (input.text ?? '');
        const isFile = fileBytes !== undefined;

        const result = await verifyData(api, {
          data,
          signatureArmored: payload.publicKey!, // actually the signature
          publicKeyArmored: String(resolved.publicKey ?? ''),
          isFile,
        });
        onProgress?.(0.9, 'Done');

        report = {
          output: JSON.stringify({
            verified: result.verified,
            signerFingerprint: result.signerFingerprint,
            signerKeyId: result.signerKeyId,
            signerUserId: result.signerUserId,
          }),
          render: 'code',
        };
        stats.verified = String(result.verified);
        stats.signerFingerprint = result.signerFingerprint;
        stats.signerKeyId = result.signerKeyId;

        if (result.verified) {
          warnings.push(`✅ Signature verified — signed by ${result.signerUserId ?? result.signerKeyId}`);
        } else {
          warnings.push('❌ Signature verification FAILED — the message was altered or the key is wrong.');
        }
        break;
      }

      case 'export': {
        onProgress?.(0.2, 'Exporting public key…');
        const result = await exportPublicKey(api, payload.privateKey!, payload.decryptPassphrase || '');
        onProgress?.(0.9, 'Done');

        outputs.push({
          filename: 'public-key.asc',
          blob: new Blob([result.publicKeyArmored], { type: 'application/pgp-keys' }),
        });

        report = {
          output: result.publicKeyArmored,
          render: 'code',
        };
        break;
      }
    }
  } catch (e: unknown) {
    if (e instanceof ToolError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (/passphrase|decrypt|encrypted/i.test(msg)) {
      throw new ToolError('Decryption failed — wrong passphrase or corrupted data.');
    }
    if (/verification|verify/i.test(msg)) {
      throw new ToolError(`Verification failed: ${msg}`);
    }
    throw new ToolError(`OpenPGP error: ${msg}`);
  }

  onProgress?.(1, 'Done');
  return { outputs, report, warnings: warnings.length ? warnings : undefined, stats };
}

const tool: FileToolModule = { meta, run };
export default tool;