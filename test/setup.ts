/**
 * Vitest global setup. jsdom + Node 20 provide most Web APIs the pure `run()`
 * functions need; we patch the gaps.
 */
import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

// jsdom's Blob/File lack arrayBuffer()/text()/stream() in this version. Node's
// native implementations (stable in 20) have them and match the browser.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
if (NodeFile) globalThis.File = NodeFile as unknown as typeof File;

if (typeof window !== 'undefined') {
  window.matchMedia ||= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
