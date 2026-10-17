import { describe, expect, it } from 'vitest';
import { ToolError } from '../types';
import {
  MODEL_ALLOWLIST,
  assertAllowedModel,
  findAllowlisted,
  isPermissiveLicense,
  normalizeLicense,
  type ModelLicenseEntry,
} from './licenses';

describe('normalizeLicense', () => {
  it('lower-cases and strips a leading license: tag', () => {
    expect(normalizeLicense('license:Apache-2.0')).toBe('apache-2.0');
    expect(normalizeLicense('  MIT ')).toBe('mit');
    expect(normalizeLicense(null)).toBe('');
  });
});

describe('isPermissiveLicense', () => {
  it('accepts common permissive licences', () => {
    for (const id of ['apache-2.0', 'MIT', 'license:BSD-3-Clause', 'isc', 'cc0-1.0']) {
      expect(isPermissiveLicense(id)).toBe(true);
    }
  });

  it('rejects non-commercial, copyleft and unknown licences', () => {
    for (const id of ['other', 'cc-by-nc-4.0', 'gpl-3.0', 'agpl-3.0', 'llama2', '', 'unknown']) {
      expect(isPermissiveLicense(id)).toBe(false);
    }
  });
});

describe('assertAllowedModel', () => {
  it('returns the entry for an allow-listed model', () => {
    const entry = assertAllowedModel('Xenova/modnet');
    expect(entry.license).toBe('apache-2.0');
  });

  it('rejects a model that is not on the allow-list', () => {
    expect(() => assertAllowedModel('someone/random-model')).toThrow(ToolError);
    expect(() => assertAllowedModel('someone/random-model')).toThrow(/not been reviewed/i);
  });

  it('rejects the non-commercial RMBG-1.4 weights', () => {
    const rmbg: ModelLicenseEntry = {
      id: 'briaai/RMBG-1.4',
      license: 'other',
      url: 'https://huggingface.co/briaai/RMBG-1.4',
    };
    expect(() => assertAllowedModel('briaai/RMBG-1.4', [rmbg])).toThrow(/does not permit reuse/i);
  });

  it('accepts a call-specific permissive model but still rejects a permissive-less one', () => {
    const ok: ModelLicenseEntry = {
      id: 'acme/whisper',
      license: 'mit',
      url: 'https://huggingface.co/acme/whisper',
    };
    expect(assertAllowedModel('acme/whisper', [ok]).license).toBe('mit');

    const bad: ModelLicenseEntry = { id: 'acme/secret', license: 'unknown', url: 'x' };
    expect(() => assertAllowedModel('acme/secret', [bad])).toThrow(ToolError);
  });

  it('rejects an empty model id', () => {
    expect(() => assertAllowedModel('  ')).toThrow(/No model/i);
  });
});

describe('allow-list hygiene', () => {
  it('every curated entry is permissive and uniquely keyed', () => {
    const ids = MODEL_ALLOWLIST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of MODEL_ALLOWLIST) {
      expect(isPermissiveLicense(entry.license)).toBe(true);
      expect(entry.url.startsWith('https://huggingface.co/')).toBe(true);
      expect(findAllowlisted(entry.id)).toBe(entry);
    }
  });
});
