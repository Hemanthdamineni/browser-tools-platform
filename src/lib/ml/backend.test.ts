import { describe, expect, it } from 'vitest';
import {
  defaultDtype,
  detectWebGpu,
  resolveBackend,
  resolveDtype,
  webGpuAvailable,
} from './backend';
import { withNavigatorGpu } from '../../../test/ml-fakes';

describe('resolveBackend', () => {
  it('auto prefers WebGPU and silently uses WASM when it is absent', () => {
    expect(resolveBackend('auto', true)).toMatchObject({ backend: 'webgpu', fellBack: false });
    expect(resolveBackend('auto', false)).toMatchObject({ backend: 'wasm', fellBack: false });
  });

  it('flags a fallback only when WebGPU was explicitly requested', () => {
    expect(resolveBackend('webgpu', true)).toMatchObject({ backend: 'webgpu', fellBack: false });
    expect(resolveBackend('webgpu', false)).toMatchObject({ backend: 'wasm', fellBack: true });
  });

  it('never overrides an explicit WASM request', () => {
    expect(resolveBackend('wasm', true)).toMatchObject({ backend: 'wasm', fellBack: false });
    expect(resolveBackend('wasm', false)).toMatchObject({ backend: 'wasm', fellBack: false });
  });
});

describe('defaultDtype / resolveDtype', () => {
  it('maps WebGPU to fp16 and WASM to q8', () => {
    expect(defaultDtype('webgpu')).toBe('fp16');
    expect(defaultDtype('wasm')).toBe('q8');
  });

  it('lets an explicit dtype win over the backend default', () => {
    expect(resolveDtype(undefined, 'webgpu')).toBe('fp16');
    expect(resolveDtype('int8', 'webgpu')).toBe('int8');
    expect(resolveDtype({ encoder_model: 'fp32' }, 'wasm')).toEqual({ encoder_model: 'fp32' });
  });
});

describe('WebGPU detection', () => {
  it('reports false when navigator.gpu is absent', async () => {
    await withNavigatorGpu(undefined, () => {
      expect(detectWebGpu()).toBe(false);
    });
    await expect(withNavigatorGpu(undefined, () => webGpuAvailable())).resolves.toBe(false);
  });

  it('is available when an adapter can be acquired', async () => {
    await withNavigatorGpu({ requestAdapter: async () => ({}) }, async () => {
      expect(detectWebGpu()).toBe(true);
      await expect(webGpuAvailable()).resolves.toBe(true);
    });
  });

  it('is unavailable when no adapter is returned or the probe throws', async () => {
    await withNavigatorGpu({ requestAdapter: async () => null }, () =>
      expect(webGpuAvailable()).resolves.toBe(false),
    );
    await withNavigatorGpu(
      {
        requestAdapter: async () => {
          throw new Error('blocked');
        },
      },
      () => expect(webGpuAvailable()).resolves.toBe(false),
    );
  });
});
