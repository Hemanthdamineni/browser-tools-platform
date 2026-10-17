import { describe, expect, it, vi } from 'vitest';
import { ProgressTracker, throttleProgress } from './progress';
import type { LoadProgress } from './types';

describe('ProgressTracker', () => {
  it('aggregates per-file bytes into a fraction', () => {
    const snapshots: LoadProgress[] = [];
    const tracker = new ProgressTracker((p) => snapshots.push(p));
    tracker.setPhase('downloading');
    tracker.fileStarted('a', 100);
    tracker.fileProgress('a', 50, 100);
    tracker.fileStarted('b', 100);
    tracker.fileProgress('b', 100, 100);

    const last = snapshots.at(-1)!;
    expect(last.phase).toBe('downloading');
    expect(last.loaded).toBe(150);
    expect(last.total).toBe(200);
    expect(last.fraction).toBeCloseTo(0.75);
    expect(last.files).toHaveLength(2);
  });

  it('counts unknown-size files as complete-so-far so the bar never stalls', () => {
    const tracker = new ProgressTracker();
    tracker.fileProgress('unknown', 40); // no total
    const snap = tracker.snapshot();
    expect(snap.total).toBe(40);
    expect(snap.fraction).toBe(1);
  });

  it('returns a null fraction before any total is known', () => {
    const tracker = new ProgressTracker();
    expect(tracker.snapshot().fraction).toBeNull();
    expect(tracker.snapshot().loaded).toBe(0);
  });

  it('marks cache hits as loaded but excludes them from network bytes', () => {
    const tracker = new ProgressTracker();
    tracker.fileCached('config.json', 500);
    tracker.fileProgress('model.onnx', 100, 1000);
    const snap = tracker.snapshot();
    expect(snap.files.find((f) => f.file === 'config.json')?.cached).toBe(true);
    expect(tracker.networkBytes).toBe(100);
    expect(tracker.cachedBytes).toBe(500);
    expect(snap.loaded).toBe(600);
  });

  it('back-fills a file total when it is first seen without one', () => {
    const tracker = new ProgressTracker();
    tracker.fileStarted('model.onnx');
    tracker.fileProgress('model.onnx', 10);
    expect(tracker.snapshot().total).toBe(10);
    tracker.fileProgress('model.onnx', 30, 400);
    expect(tracker.snapshot().total).toBe(400);
    tracker.fileDone('model.onnx');
    expect(tracker.snapshot().loaded).toBe(400);
  });

  it('deduplicates warnings and resets file state', () => {
    const tracker = new ProgressTracker();
    tracker.warn('quota full');
    tracker.warn('quota full');
    tracker.fileProgress('a', 1, 2);
    expect(tracker.snapshot().warnings).toEqual(['quota full']);

    tracker.reset();
    const snap = tracker.snapshot();
    expect(snap.files).toHaveLength(0);
    expect(snap.warnings).toHaveLength(0);
  });

  it('emits a snapshot on every mutation', () => {
    const emit = vi.fn();
    const tracker = new ProgressTracker(emit);
    tracker.setPhase('downloading');
    tracker.fileProgress('a', 1, 2);
    expect(emit).toHaveBeenCalledTimes(2);
  });
});

describe('throttleProgress', () => {
  function sample(phase: LoadProgress['phase'], loaded: number): LoadProgress {
    return { phase, fraction: null, loaded, total: 100, files: [], message: '', warnings: [] };
  }

  it('coalesces updates inside the window and flushes the newest on demand', () => {
    let clock = 0;
    const emit = vi.fn();
    const throttled = throttleProgress(emit, 100, () => clock);

    throttled(sample('downloading', 10)); // first -> emitted
    throttled(sample('downloading', 20)); // coalesced
    throttled(sample('downloading', 30)); // coalesced
    expect(emit).toHaveBeenCalledTimes(1);

    clock = 100;
    throttled(sample('downloading', 40)); // window elapsed -> emitted
    expect(emit).toHaveBeenCalledTimes(2);

    throttled(sample('downloading', 50)); // coalesced
    throttled.flush();
    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit.mock.calls.at(-1)?.[0].loaded).toBe(50);
  });

  it('always emits a phase change immediately', () => {
    const emit = vi.fn();
    const throttled = throttleProgress(emit, 100, () => 0);
    throttled(sample('downloading', 10));
    throttled(sample('ready', 100));
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1]?.[0].phase).toBe('ready');
  });

  it('emits everything when throttling is disabled', () => {
    const emit = vi.fn();
    const throttled = throttleProgress(emit, 0);
    throttled(sample('downloading', 1));
    throttled(sample('downloading', 2));
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
