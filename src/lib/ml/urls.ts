/**
 * Pure URL / cache-key helpers for the ML loader. No DOM, no network, no
 * browser globals — everything here is unit-testable in isolation.
 *
 * The default model source is the Hugging Face Hub:
 *   https://huggingface.co/<model>/resolve/<revision>/<file>
 * matching transformers.js's own `env.remoteHost` + `env.remotePathTemplate`.
 */

/** Default remote host (Hugging Face Hub). */
export const DEFAULT_REMOTE_HOST = 'https://huggingface.co/';

/** transformers.js path template: `{model}/resolve/{revision}/`. */
export const HF_PATH_TEMPLATE = '{model}/resolve/{revision}/';

/** Default revision. */
export const DEFAULT_REVISION = 'main';

/** Hosts the loader is allowed to reach out to by default. */
export const DEFAULT_ALLOWED_HOSTS: readonly string[] = ['huggingface.co', 'hf.co'];

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

/**
 * Build the canonical download URL for a file in a model repo.
 *
 * `model` may contain slashes (`org/name`) and is preserved as-is; `revision`
 * is percent-encoded (it can be a git ref); `file` may contain slashes
 * (`onnx/model.onnx`) and is preserved.
 */
export function modelFileUrl(
  model: string,
  file: string,
  revision: string = DEFAULT_REVISION,
  host: string = DEFAULT_REMOTE_HOST,
): string {
  const base = trimTrailingSlash(host);
  const repo = trimLeadingSlash(trimTrailingSlash(model.trim()));
  const path = trimLeadingSlash(file.trim());
  return `${base}/${repo}/resolve/${encodeURIComponent(revision)}/${path}`;
}

/**
 * Derive a stable Cache Storage key from a download URL. The key is the
 * origin + path with query/hash stripped, so `?download=true` style parameters
 * don't fragment the cache. Unparseable (relative) keys are returned unchanged.
 */
export function cacheKeyForUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/** True when `url`'s host is one of `hosts` (exact match, sub-domains excluded). */
export function isAllowedHost(
  url: string,
  hosts: readonly string[] = DEFAULT_ALLOWED_HOSTS,
): boolean {
  try {
    const { host } = new URL(url);
    return hosts.some((h) => h.toLowerCase() === host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Reverse of `modelFileUrl`: split a Hub file URL back into its parts. Returns
 * `null` for URLs that don't match `host`'s `<model>/resolve/<revision>/<file>`
 * shape (e.g. static assets or a CDN mirror with a different layout).
 */
export function parseModelUrl(
  url: string,
  host: string = DEFAULT_REMOTE_HOST,
): { model: string; revision: string; file: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const expectedHost = (() => {
    try {
      return new URL(host).host;
    } catch {
      return host;
    }
  })();
  if (parsed.host.toLowerCase() !== expectedHost.toLowerCase()) return null;

  const path = parsed.pathname.replace(/^\/+/, '');
  const marker = '/resolve/';
  const at = path.indexOf(marker);
  if (at <= 0) return null;

  const model = path.slice(0, at);
  const rest = path.slice(at + marker.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;

  const rawRevision = rest.slice(0, slash);
  const file = rest.slice(slash + 1);
  let revision: string;
  try {
    revision = decodeURIComponent(rawRevision);
  } catch {
    revision = rawRevision;
  }
  return { model, revision, file };
}

/** The last path segment of a URL or path (used as a progress label). */
export function fileNameFromUrl(url: string): string {
  const clean = url.split(/[?#]/, 1)[0] ?? url;
  const parts = clean.split('/').filter(Boolean);
  return parts.length ? (parts[parts.length - 1] as string) : url;
}
