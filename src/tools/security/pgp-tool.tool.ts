import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pgp-tool.meta';
import {
  decryptData,
  encryptData,
  exportPublicKey,
  generateKeyPair,
  signData,
  verifyData,
  type OpenPgpApi,
} from '@/components/panels/pgp-tool-panel';

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
import * as openpgp from 'openpgp';

const api = openpgp as unknown as OpenPgpApi;

/** Mode dispatch is driven by the panel, mirrored by the generic workbench. */
type Mode = 'generate' | 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'import';

function normalizeMode(value: string): Mode {
  switch (value) {
    case 'encrypt':
    case 'decrypt':
    case 'sign':
    case 'verify':
    case 'import':
      return value;
    default:
      return 'generate';
  }
}

/** Read a dropped file's bytes, or return undefined when none was chosen. */
async function readFileBytes(input: FileRunInput): Promise<Uint8Array | undefined> {
  const file = input.files[0];
  if (!file) return undefined;
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.1, 'Reading file');
  const buf = await file.arrayBuffer();
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.2, 'Read file');
  return new Uint8Array(buf);
}

/** The last-chosen public key, kept in a module field so the panel can pre-fill. */

export async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);

  const mode = normalizeMode(String(o.mode));
  input.signal?.throwIfAborted?.();

  switch (mode) {
    case 'generate': {
      input.onProgress?.(0.1, 'Generating key');
      const generated = await generateKeyPair(api, {
        keyType: String(o.keyType) as 'ed25519' | 'nistp256' | 'rsa2048' | 'rsa4096',
        name: String(o.name ?? ''),
        email: String(o.email ?? ''),
        passphrase: String(o.passphrase ?? ''),
      });
      input.onProgress?.(1, 'Key generated');
      const warning = o.passphrase
        ? []
        : ['This key has no passphrase. Anyone who obtains the private key can use it.'];
      return {
        outputs: [],
        report: {
          output: JSON.stringify(
            {
              fingerprint: generated.formattedFingerprint,
              keyID: generated.keyID,
              userIDs: generated.userIDs,
              privateKey: generated.privateKey,
              publicKey: generated.publicKey,
              revocationCertificate: generated.revocationCertificate,
            },
            null,
            2,
          ),
          render: 'code',
          language: 'json',
        },
        notes: [
          'Private keys live only in this browser tab.',
          'Save the private key before closing — it cannot be recovered.',
        ],
        warnings: warning,
        stats: {
          keyType: String(o.keyType),
          fingerprint: generated.formattedFingerprint,
          userIDs: generated.userIDs.join('; '),
        },
      };
    }

    case 'encrypt': {
      const binary = await readFileBytes(input);
      const result = await encryptData(api, {
        text: input.text,
        binary,
        filename: input.files[0]?.name,
        publicKeyArmor: String(o.publicKey ?? ''),
        output: String(o.output) === 'binary' ? 'binary' : 'armored',
      });
      input.onProgress?.(1, 'Encrypted');
      const outputs = result.binary
        ? [
            {
              filename: (input.files[0]?.name ?? 'message') + '.pgp',
              blob: new Blob([result.binary as BlobPart], { type: 'application/octet-stream' }),
            },
          ]
        : [];
      return {
        outputs,
        report: result.armored
          ? { output: result.armored, render: 'code', language: 'text' }
          : undefined,
        notes: ['Encrypted to the pasted public key.'],
        stats: {
          to: result.userIDs.join('; ') || result.fingerprint,
          fingerprint: formatFingerprintShort(result.fingerprint),
        },
      };
    }

    case 'decrypt': {
      const binary = await readFileBytes(input);
      const result = await decryptData(api, {
        armored: input.text && !binary ? input.text : undefined,
        binary,
        privateKeyArmor: String(o.privateKey ?? ''),
        passphrase: String(o.passphrase ?? ''),
        binaryOutput: Boolean(binary),
      });
      input.onProgress?.(1, 'Decrypted');
      const outputs = result.binary
        ? [
            {
              filename: result.filename ?? 'decrypted.bin',
              blob: new Blob([result.binary as BlobPart], { type: 'application/octet-stream' }),
            },
          ]
        : [];
      const sigs = result.signatures.length
        ? `Signed by key ${result.signatures[0]!.keyID.toHex()}`
        : 'Message was not signed.';
      return {
        outputs,
        report: result.text !== undefined ? { output: result.text, render: 'text' } : undefined,
        notes: [sigs],
      };
    }

    case 'sign': {
      if (!input.text) throw new ToolError('Enter the text to sign.');
      const result = await signData(api, {
        text: input.text,
        privateKeyArmor: String(o.privateKey ?? ''),
        passphrase: String(o.passphrase ?? ''),
        style: String(o.signatureStyle) === 'clearsign' ? 'clearsign' : 'detached',
      });
      input.onProgress?.(1, 'Signed');
      const outputs = result.signatureArmor
        ? [
            {
              filename: 'signature.asc',
              blob: new Blob([result.signatureArmor], { type: 'text/plain; charset=utf-8' }),
            },
          ]
        : [];
      return {
        outputs,
        report: result.clearsigned
          ? { output: result.clearsigned, render: 'text' }
          : result.signatureArmor
            ? { output: result.signatureArmor, render: 'code', language: 'text' }
            : undefined,
        notes: ['Signed with the pasted private key.'],
        stats: {
          signer: result.userIDs.join('; ') || result.fingerprint,
          fingerprint: formatFingerprintShort(result.fingerprint),
        },
      };
    }

    case 'verify': {
      const binary = await readFileBytes(input);
      const result = await verifyData(api, {
        text: input.text,
        binary,
        signatureArmor: String(o.signature ?? ''),
        publicKeyArmor: String(o.publicKey ?? ''),
      });
      input.onProgress?.(1, 'Verified');
      return {
        outputs: [],
        report: {
          output: `Signature valid.\n\nSigned by ${result.userIDs.join('; ') || 'an unknown key'} (key ${result.keyID}).`,
          render: 'text',
        },
        notes: ['The message was not altered after it was signed.'],
        stats: {
          valid: 'yes',
          signer: result.userIDs.join('; ') || result.fingerprint,
          fingerprint: formatFingerprintShort(result.fingerprint),
        },
      };
    }

    case 'import': {
      const binary = await readFileBytes(input);
      if (binary) {
        throw new ToolError('Import a key block as text, not as a file.');
      }
      const exported = await exportPublicKey(
        api,
        String(o.privateKey ?? ''),
        String(o.passphrase ?? ''),
      );
      return {
        outputs: [],
        report: {
          output: exported.publicKey,
          render: 'code',
          language: 'text',
        },
        notes: ['Exported the public key from the private key.'],
        stats: {
          fingerprint: formatFingerprintShort(exported.fingerprint),
          userIDs: exported.userIDs.join('; '),
        },
      };
    }
  }
}

/** First 16 hex chars of a fingerprint, for compact stats. */
function formatFingerprintShort(fp: string): string {
  return fp.slice(0, 16);
}

const tool: FileToolModule = { meta, run };
export default tool;
