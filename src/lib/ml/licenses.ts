/**
 * Model-licence gate.
 *
 * Model *weights* are third-party artefacts with their own licences, separate
 * from the code that runs them. This project only ships models whose licence
 * permits redistribution and commercial use, so the loader **denies by
 * default**: a model id must appear on the curated allow-list below (or be
 * passed as an explicit, still-permissive `extra` entry) or the load is
 * rejected. This is a deliberate allow-list, not a deny-list, so an unknown or
 * freshly uploaded model can never slip in unreviewed.
 *
 * `RMBG-1.4` (briaai) declares `license: other` (non-commercial) and is the
 * canonical counter-example: it must stay rejected.
 */
import { ToolError } from '../types';

/** A model repo that has been reviewed and is cleared for use. */
export interface ModelLicenseEntry {
  /** Hugging Face repo id, e.g. `Xenova/modnet`. */
  id: string;
  /** Lower-case SPDX-ish licence id exactly as the HF model card declares it. */
  license: string;
  /** Where the licence is recorded (the HF model page). */
  url: string;
  /** Free-form note for maintainers (why it's here, what it powers). */
  note?: string;
}

/**
 * Licence ids that are permissive enough to ship. Intentionally conservative:
 * `cc-by-nc-*`, `other`, `unknown`, `gpl-*`, `agpl-*` and bespoke research
 * licences are all rejected.
 */
export const PERMISSIVE_LICENSES: readonly string[] = [
  'apache-2.0',
  'mit',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
  'mpl-2.0',
  'cc0-1.0',
  'unlicense',
];

/**
 * Curated allow-list. Every entry was verified against the live Hugging Face
 * model card (via `GET https://huggingface.co/api/models/<id>`, field
 * `cardData.license`) on 2026-10-17. Re-verify before adding or removing one.
 */
export const MODEL_ALLOWLIST: readonly ModelLicenseEntry[] = [
  {
    id: 'Xenova/whisper-tiny.en',
    license: 'apache-2.0',
    url: 'https://huggingface.co/Xenova/whisper-tiny.en',
    note: 'Whisper tiny (English) — speech-to-text.',
  },
  {
    id: 'Xenova/whisper-base',
    license: 'apache-2.0',
    url: 'https://huggingface.co/Xenova/whisper-base',
    note: 'Whisper base — multilingual speech-to-text.',
  },
  {
    id: 'Xenova/modnet',
    license: 'apache-2.0',
    url: 'https://huggingface.co/Xenova/modnet',
    note: 'MODNet portrait matting — background remover (RMBG-1.4 is non-commercial).',
  },
  {
    id: 'Xenova/all-MiniLM-L6-v2',
    license: 'apache-2.0',
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2',
    note: 'Sentence embeddings — semantic search / clustering.',
  },
];

/**
 * Normalise a licence string for comparison: strip a leading `license:` tag
 * (HF exposes it that way in `tags`) and lower-case it.
 */
export function normalizeLicense(license: string | null | undefined): string {
  if (!license) return '';
  return license
    .trim()
    .toLowerCase()
    .replace(/^license:/, '');
}

/** Whether a licence id is on the permissive list. */
export function isPermissiveLicense(license: string | null | undefined): boolean {
  const id = normalizeLicense(license);
  return id !== '' && PERMISSIVE_LICENSES.includes(id);
}

/** Look up an entry across the base allow-list plus any call-specific extras. */
export function findAllowlisted(
  modelId: string,
  extra: readonly ModelLicenseEntry[] = [],
): ModelLicenseEntry | undefined {
  const id = modelId.trim();
  return extra.find((e) => e.id === id) ?? MODEL_ALLOWLIST.find((e) => e.id === id);
}

/**
 * Enforce the licence gate for a model id. Returns the matching allow-list
 * entry, or throws a user-facing `ToolError` explaining the rejection.
 */
export function assertAllowedModel(
  modelId: string,
  extra: readonly ModelLicenseEntry[] = [],
): ModelLicenseEntry {
  const id = modelId.trim();
  if (!id) {
    throw new ToolError(
      'No model was specified.',
      'Pass a Hugging Face repo id such as "Xenova/modnet".',
    );
  }

  const entry = findAllowlisted(id, extra);
  if (!entry) {
    throw new ToolError(
      `The model "${id}" has not been reviewed for a permissive licence.`,
      'Only models on the reviewed allow-list can be downloaded. See docs/ML-RUNTIME.md to request one.',
    );
  }
  if (!isPermissiveLicense(entry.license)) {
    throw new ToolError(
      `The model "${id}" is licensed "${entry.license}", which does not permit reuse here.`,
      'Pick a model with a permissive licence (Apache-2.0, MIT, BSD, …).',
    );
  }
  return entry;
}
