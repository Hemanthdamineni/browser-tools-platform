import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMOTE_HOST,
  cacheKeyForUrl,
  fileNameFromUrl,
  isAllowedHost,
  modelFileUrl,
  parseModelUrl,
} from './urls';

describe('modelFileUrl', () => {
  it('builds a Hub resolve URL, preserving model and file slashes', () => {
    expect(modelFileUrl('Xenova/modnet', 'onnx/model.onnx')).toBe(
      'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    );
  });

  it('percent-encodes the revision but not the model path', () => {
    expect(modelFileUrl('Xenova/modnet', 'config.json', 'refs/pr/1')).toBe(
      'https://huggingface.co/Xenova/modnet/resolve/refs%2Fpr%2F1/config.json',
    );
  });

  it('tolerates a trailing slash on the host', () => {
    expect(modelFileUrl('a/b', 'f.json', 'main', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/a/b/resolve/main/f.json',
    );
  });

  it('defaults to the HF Hub host', () => {
    expect(modelFileUrl('a/b', 'f.json')).toContain(DEFAULT_REMOTE_HOST);
  });
});

describe('cacheKeyForUrl', () => {
  it('strips query and hash so signed-download params do not fragment the cache', () => {
    expect(cacheKeyForUrl('https://huggingface.co/a/b/resolve/main/f.onnx?download=true#x')).toBe(
      'https://huggingface.co/a/b/resolve/main/f.onnx',
    );
  });

  it('returns unparseable keys unchanged', () => {
    expect(cacheKeyForUrl('onnx/model.onnx')).toBe('onnx/model.onnx');
  });
});

describe('isAllowedHost', () => {
  it('accepts the Hub hosts and rejects everything else', () => {
    expect(isAllowedHost('https://huggingface.co/a/b/resolve/main/f')).toBe(true);
    expect(isAllowedHost('https://hf.co/a/b')).toBe(true);
    expect(isAllowedHost('https://huggingface.co.evil.test/a')).toBe(false);
    expect(isAllowedHost('https://evil.test/a')).toBe(false);
    expect(isAllowedHost('not a url')).toBe(false);
  });
});

describe('parseModelUrl', () => {
  it('round-trips model, revision and file', () => {
    const url = modelFileUrl('Xenova/modnet', 'onnx/model_quantized.onnx');
    expect(parseModelUrl(url)).toEqual({
      model: 'Xenova/modnet',
      revision: 'main',
      file: 'onnx/model_quantized.onnx',
    });
  });

  it('decodes an encoded revision', () => {
    expect(parseModelUrl(modelFileUrl('a/b', 'f.json', 'refs/pr/1'))?.revision).toBe('refs/pr/1');
  });

  it('returns null for a foreign host or an unexpected shape', () => {
    expect(parseModelUrl('https://cdn.example.com/a/b/resolve/main/f.json')).toBeNull();
    expect(parseModelUrl('https://huggingface.co/a/b/main/f.json')).toBeNull();
    expect(parseModelUrl('https://huggingface.co/resolve/main/f.json')).toBeNull();
  });
});

describe('fileNameFromUrl', () => {
  it('returns the last path segment', () => {
    expect(fileNameFromUrl('https://huggingface.co/a/b/resolve/main/onnx/model.onnx')).toBe(
      'model.onnx',
    );
  });
});
