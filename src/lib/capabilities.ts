/**
 * Runtime feature detection. SSR-safe: every check is lazy and guarded, so this
 * module can be imported anywhere. Tools use it to show honest "not supported in
 * this browser" messages instead of failing silently.
 */

function has(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

export const capabilities = {
  get isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  },
  get webCrypto() {
    return has(() => typeof crypto !== 'undefined' && !!crypto.subtle);
  },
  get workers() {
    return has(() => typeof Worker !== 'undefined');
  },
  get offscreenCanvas() {
    return has(() => typeof OffscreenCanvas !== 'undefined');
  },
  get createImageBitmap() {
    return has(() => typeof createImageBitmap === 'function');
  },
  get webAudio() {
    return has(() => 'AudioContext' in window || 'webkitAudioContext' in window);
  },
  get mediaRecorder() {
    return has(() => typeof MediaRecorder !== 'undefined');
  },
  get getDisplayMedia() {
    return has(() => !!navigator.mediaDevices?.getDisplayMedia);
  },
  get barcodeDetector() {
    return has(() => 'BarcodeDetector' in window);
  },
  get fileSystemAccess() {
    return has(() => 'showOpenFilePicker' in window);
  },
  get opfs() {
    return has(() => !!navigator.storage?.getDirectory);
  },
  get webShare() {
    return has(() => typeof navigator.share === 'function');
  },
  get speechSynthesis() {
    return has(() => 'speechSynthesis' in window);
  },
  get webCodecs() {
    return has(() => 'VideoEncoder' in window && 'VideoDecoder' in window);
  },
  /** Best guess at device memory in GB (Chromium only); undefined elsewhere. */
  get deviceMemoryGB(): number | undefined {
    return has(() => 'deviceMemory' in navigator)
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined;
  },
  get hardwareThreads() {
    return has(() => navigator.hardwareConcurrency > 0) ? navigator.hardwareConcurrency : 4;
  },
  imageOutputType(mime: string): boolean {
    if (!this.isBrowser) return false;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      return c.toDataURL(mime).startsWith(`data:${mime}`);
    } catch {
      return false;
    }
  },
};

export type Capabilities = typeof capabilities;
