/**
 * Download/progress bookkeeping for the ML loader.
 *
 * `ProgressTracker` is pure (no browser APIs, injectable clock) and turns a
 * stream of per-file byte updates into the aggregate `LoadProgress` snapshots a
 * progress bar needs. `throttleProgress` wraps a tracker's sink so a 300 MB
 * download doesn't fire thousands of DOM updates.
 */
import type { FileProgress, LoadPhase, LoadProgress } from './types';

const PHASE_MESSAGES: Record<LoadPhase, string> = {
  resolving: 'Preparing…',
  downloading: 'Downloading model…',
  initializing: 'Starting the model…',
  ready: 'Model ready',
  error: 'Model load failed',
};

export interface ProgressTrackerOptions {
  /** Injected clock, for deterministic tests. */
  now?: () => number;
  /** Initial phase. Defaults to `'resolving'`. */
  phase?: LoadPhase;
}

export class ProgressTracker {
  private readonly emit: (progress: LoadProgress) => void;
  private readonly now: () => number;
  private readonly files = new Map<string, FileProgress>();
  private phase: LoadPhase;
  private message: string;
  private warnings: string[] = [];

  constructor(
    emit: (progress: LoadProgress) => void = () => {},
    options: ProgressTrackerOptions = {},
  ) {
    this.emit = emit;
    this.now = options.now ?? (() => Date.now());
    this.phase = options.phase ?? 'resolving';
    this.message = PHASE_MESSAGES[this.phase];
  }

  /** Total bytes received from the network (cache hits excluded). */
  get networkBytes(): number {
    let total = 0;
    for (const file of this.files.values()) if (!file.cached) total += file.loaded;
    return total;
  }

  /** Bytes attributed to files that came from Cache Storage. */
  get cachedBytes(): number {
    let total = 0;
    for (const file of this.files.values()) if (file.cached) total += file.loaded;
    return total;
  }

  get currentPhase(): LoadPhase {
    return this.phase;
  }

  setPhase(phase: LoadPhase, message?: string): void {
    this.phase = phase;
    this.message = message ?? PHASE_MESSAGES[phase];
    this.publish();
  }

  /** A new file has appeared (Content-Length may still be unknown). */
  fileStarted(file: string, total = 0): void {
    if (!this.files.has(file)) {
      this.files.set(file, { file, loaded: 0, total: Math.max(0, total), cached: false });
    }
    this.publish();
  }

  /** Byte progress for a file being downloaded. */
  fileProgress(file: string, loaded: number, total?: number): void {
    const entry = this.ensure(file);
    entry.loaded = Math.max(0, loaded);
    if (total !== undefined && total > 0) entry.total = total;
    this.publish();
  }

  /** A file was served from Cache Storage: instantly complete. */
  fileCached(file: string, bytes: number): void {
    const entry = this.ensure(file);
    entry.cached = true;
    entry.loaded = Math.max(0, bytes);
    entry.total = Math.max(0, bytes);
    this.publish();
  }

  /** A file finished loading; accounts for a missing Content-Length. */
  fileDone(file: string, bytes?: number): void {
    const entry = this.ensure(file);
    if (bytes !== undefined) {
      entry.loaded = Math.max(0, bytes);
      entry.total = Math.max(entry.total, entry.loaded);
    } else if (entry.total > 0) {
      entry.loaded = entry.total;
    }
    this.publish();
  }

  /** Record a non-fatal warning (deduplicated). */
  warn(message: string): void {
    if (!this.warnings.includes(message)) this.warnings.push(message);
    this.publish();
  }

  /** Drop all file state (used when retrying on a different backend). */
  reset(): void {
    this.files.clear();
    this.warnings = [];
    this.publish();
  }

  snapshot(): LoadProgress {
    const files = [...this.files.values()].map((f) => ({ ...f }));
    let loaded = 0;
    let total = 0;
    for (const file of files) {
      loaded += file.loaded;
      // A file with no known total contributes its loaded bytes to both sides so
      // it doesn't stall the aggregate bar at < 1.
      total += file.total > 0 ? file.total : file.loaded;
    }
    return {
      phase: this.phase,
      fraction: total > 0 ? Math.min(1, loaded / total) : null,
      loaded,
      total,
      files,
      message: this.message,
      warnings: [...this.warnings],
    };
  }

  private ensure(file: string): FileProgress {
    let entry = this.files.get(file);
    if (!entry) {
      entry = { file, loaded: 0, total: 0, cached: false };
      this.files.set(file, entry);
    }
    return entry;
  }

  private publish(): void {
    this.emit(this.snapshot());
  }
}

export interface ThrottledProgress {
  (progress: LoadProgress): void;
  /** Emit the pending snapshot immediately (call before resolving). */
  flush(): void;
}

/**
 * Coalesce progress events to at most one per `intervalMs`, while always
 * emitting a change of `phase` and always keeping the newest snapshot for the
 * next tick. `intervalMs <= 0` disables throttling (emits everything).
 */
export function throttleProgress(
  emit: (progress: LoadProgress) => void,
  intervalMs = 100,
  now: () => number = () => Date.now(),
): ThrottledProgress {
  let lastEmit = Number.NEGATIVE_INFINITY;
  let lastPhase: LoadPhase | null = null;
  let pending: LoadProgress | null = null;

  const throttled = (progress: LoadProgress): void => {
    if (intervalMs <= 0) {
      lastPhase = progress.phase;
      emit(progress);
      return;
    }
    const t = now();
    if (progress.phase !== lastPhase || t - lastEmit >= intervalMs) {
      lastPhase = progress.phase;
      lastEmit = t;
      pending = null;
      emit(progress);
    } else {
      pending = progress;
    }
  };

  throttled.flush = (): void => {
    if (pending) {
      lastEmit = now();
      const snapshot = pending;
      pending = null;
      emit(snapshot);
    }
  };

  return throttled;
}
