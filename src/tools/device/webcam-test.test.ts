import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './webcam-test.tool';
import { meta } from './webcam-test.meta';
import {
  MAX_DIMENSION,
  MAX_FPS,
  MAX_INPUT_CHARS,
  RESOLUTION_CHOICES,
  RESOLUTION_VALUES,
  buildNotes,
  buildReportRows,
  buildStats,
  displayLabel,
  formatFrameRate,
  formatResolution,
  framesPerSecond,
  fpsDiscrepancy,
  fpsWarning,
  parseWebcamFacts,
  resolutionConstraint,
  resolutionLabel,
  roundFps,
  summariseCameraList,
  type WebcamFacts,
} from './webcam-test.core';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};

const run = (text: string, options: Record<string, unknown> = {}): Result =>
  tool.run({ text, options }) as Result;

const rowsOf = (result: Result): string[][] => JSON.parse(result.output).rows;

const LIVE_FACTS = {
  state: 'live',
  cameraLabel: 'FaceTime HD Camera',
  width: 1280,
  height: 720,
  reportedFps: 30,
  measuredFps: 29.8,
  hasAudio: false,
  cameras: [{ deviceId: 'cam-1', label: 'FaceTime HD Camera' }],
  settings: { width: 1280, height: 720, frameRate: 30 },
  errorMessage: null,
};

const payload = (facts: unknown = LIVE_FACTS): string => JSON.stringify(facts);

describe('webcam-test tool', () => {
  it('reports the camera, resolution, frame rate and audio as a table', () => {
    const result = run(payload());
    expect(result.render).toBe('table');
    const rows = rowsOf(result);
    expect(rows).toContainEqual(['Camera', 'FaceTime HD Camera']);
    expect(rows).toContainEqual(['Resolution', '1280 × 720 px']);
    expect(rows).toContainEqual(['Frame rate', '30 fps reported · 29.8 fps measured']);
    expect(rows).toContainEqual(['Audio', 'No — video only']);
    expect(rows).toContainEqual(['Cameras detected', '1 camera']);
    expect(JSON.parse(result.output).headers).toEqual(['Property', 'Value']);
  });

  it('reports the key numbers as stats', () => {
    const result = run(payload());
    expect(result.stats).toMatchObject({
      state: 'live',
      cameras: 1,
      audio: 'no',
      width: 1280,
      height: 720,
      fps: 29.8,
    });
  });

  it('includes the raw track settings only when the option asks for them', () => {
    const withSettings = rowsOf(run(payload(), { includeSettings: true }));
    expect(withSettings.some((row) => row[0] === 'Track settings')).toBe(true);
    expect(withSettings.find((row) => row[0] === 'Track settings')?.[1]).toContain('1280');

    const withoutSettings = rowsOf(run(payload(), { includeSettings: false }));
    expect(withoutSettings.some((row) => row[0] === 'Track settings')).toBe(false);
  });

  it('shows the requested resolution and validates the option value', () => {
    expect(rowsOf(run(payload(), { resolution: '1280' }))).toContainEqual([
      'Requested resolution',
      '1280 × 720',
    ]);
    expect(rowsOf(run(payload(), { resolution: 'auto' }))).toContainEqual([
      'Requested resolution',
      'Browser default',
    ]);
    expect(() => run(payload(), { resolution: '4096' })).toThrow(ToolError);
    expect(() => run(payload(), { resolution: 42 })).toThrow(ToolError);
    expect(() => run(payload(), { includeSettings: 'yes' })).toThrow(ToolError);
  });

  it('keeps the meta options and the core choices in step', () => {
    const resolution = meta.options?.find((option) => option.key === 'resolution');
    expect(resolution?.type).toBe('select');
    expect(resolution && resolution.type === 'select' ? resolution.choices : []).toEqual(
      RESOLUTION_CHOICES,
    );
    expect(RESOLUTION_VALUES).toContain('auto');
  });

  it('reports a denied camera instead of pretending it works', () => {
    const result = run(
      payload({
        state: 'denied',
        cameraLabel: '',
        cameras: [],
        errorMessage: 'Camera permission was denied.',
      }),
    );
    const rows = rowsOf(result);
    expect(rows).toContainEqual(['Status', 'Permission denied']);
    expect(rows).toContainEqual(['Details', 'Camera permission was denied.']);
    expect(rows).toContainEqual(['Cameras detected', 'No cameras detected']);
    // A failed camera has no resolution row — an empty cell would be a lie.
    expect(rows.some((row) => row[0] === 'Resolution')).toBe(false);
    expect(result.notes?.join(' ')).toContain('Allow camera access');
  });

  it('warns when the preview delivered fewer frames than the track claims', () => {
    const result = run(payload({ ...LIVE_FACTS, reportedFps: 30, measuredFps: 12 }));
    expect(result.warnings?.[0]).toMatch(/dropping frames/i);
    expect(fpsWarning(parseWebcamFacts(payload({ ...LIVE_FACTS, measuredFps: 12 })))).toMatch(
      /dropping frames/i,
    );
    // Within tolerance there is nothing to warn about.
    expect(fpsWarning(parseWebcamFacts(payload({ ...LIVE_FACTS, measuredFps: 29 })))).toBeNull();
  });

  it('rejects empty, malformed and oversized input', () => {
    expect(() => run('')).toThrow(ToolError);
    expect(() => run('   ')).toThrow(ToolError);
    expect(() => run('{not json')).toThrow(ToolError);
    expect(() => run('[]')).toThrow(ToolError);
    expect(() => run('"a string"')).toThrow(ToolError);
    expect(() => run('{"state":"live"}'.repeat(20_000))).toThrow(ToolError);
    expect(() => run('x'.repeat(MAX_INPUT_CHARS + 1))).toThrow(/too large/i);
  });

  it('rejects missing and wrongly typed fields', () => {
    expect(() => run(payload({ ...LIVE_FACTS, state: undefined }))).toThrow(/state/i);
    expect(() => run(payload({ ...LIVE_FACTS, state: 'sideways' }))).toThrow(/state/i);
    expect(() => run(payload({ ...LIVE_FACTS, width: undefined }))).toThrow(/resolution/i);
    expect(() => run(payload({ ...LIVE_FACTS, width: '1280' }))).toThrow(ToolError);
    expect(() => run(payload({ ...LIVE_FACTS, height: null, width: 1280 }))).toThrow(/resolution/i);
    expect(() => run(payload({ ...LIVE_FACTS, hasAudio: 'yes' }))).toThrow(ToolError);
    expect(() => run(payload({ ...LIVE_FACTS, cameras: 'two' }))).toThrow(ToolError);
    expect(() => run(payload({ ...LIVE_FACTS, cameras: [null] }))).toThrow(ToolError);
    expect(() => run(payload({ ...LIVE_FACTS, settings: [1, 2] }))).toThrow(ToolError);
    expect(() => run(payload({ ...LIVE_FACTS, cameraLabel: 42 }))).toThrow(ToolError);
  });

  it('rejects implausible numbers', () => {
    expect(() => run(payload({ ...LIVE_FACTS, width: MAX_DIMENSION + 1 }))).toThrow(/out of range/i);
    expect(() => run(payload({ ...LIVE_FACTS, height: 0 }))).toThrow(/out of range/i);
    expect(() => run(payload({ ...LIVE_FACTS, measuredFps: -1 }))).toThrow(/out of range/i);
    expect(() => run(payload({ ...LIVE_FACTS, measuredFps: MAX_FPS + 1 }))).toThrow(
      /out of range/i,
    );
    // 1e999 survives JSON.parse as Infinity — the parser must not accept it.
    expect(() =>
      run('{"state":"live","width":1280,"height":720,"reportedFps":1e999}'),
    ).toThrow(/finite/i);
  });

  it('treats a non-finite number that JSON dropped as "not measured"', () => {
    // JSON.stringify turns NaN and Infinity into null, so they arrive as absent.
    const facts = parseWebcamFacts(payload({ ...LIVE_FACTS, reportedFps: Number.NaN }));
    expect(facts.reportedFps).toBeNull();
    const result = run(payload({ ...LIVE_FACTS, reportedFps: Number.POSITIVE_INFINITY }));
    expect(rowsOf(result)).toContainEqual(['Frame rate', '29.8 fps measured']);
  });

  it('keeps Unicode device names intact', () => {
    const name = 'Камера — 摄像头 📷 ( façades )';
    const result = run(payload({ ...LIVE_FACTS, cameraLabel: name }));
    expect(rowsOf(result)).toContainEqual(['Camera', name]);
    const facts = parseWebcamFacts(payload({ ...LIVE_FACTS, cameraLabel: name }));
    expect(facts.cameraLabel).toBe(name);
    expect(displayLabel('   ')).toBe('Unnamed camera');
  });

  it('treats an unknown camera label as unnamed rather than blank', () => {
    const result = run(payload({ ...LIVE_FACTS, cameraLabel: '' }));
    expect(rowsOf(result)).toContainEqual(['Camera', 'Unnamed camera']);
  });

  it('summarises a camera list that has no names yet', () => {
    expect(
      summariseCameraList([
        { deviceId: 'a', label: '' },
        { deviceId: 'b', label: '' },
      ]),
    ).toBe('2 cameras detected (names hidden until you allow access)');
    expect(summariseCameraList([{ deviceId: 'a', label: 'One' }, { deviceId: 'b', label: '' }])).toBe(
      '2 cameras detected (1 named)',
    );
    expect(summariseCameraList([])).toBe('No cameras detected');
  });
});

describe('webcam-test core', () => {
  it('turns a frame count into frames per second', () => {
    expect(framesPerSecond(30, 1000)).toBe(30);
    expect(framesPerSecond(60, 2000)).toBe(30);
    expect(framesPerSecond(0, 1000)).toBe(0);
    expect(framesPerSecond(30, 0)).toBe(0);
    expect(framesPerSecond(30, -100)).toBe(0);
    expect(framesPerSecond(Number.NaN, 1000)).toBe(0);
    expect(framesPerSecond(1, 1)).toBe(1000);
  });

  it('rounds frame rates to something readable', () => {
    expect(roundFps(29.97)).toBe(30);
    expect(roundFps(29.94)).toBe(29.9);
    expect(roundFps(0)).toBe(0);
    expect(roundFps(-4)).toBe(0);
    expect(roundFps(Number.NaN)).toBe(0);
    expect(roundFps(12.345, 2)).toBe(12.35);
  });

  it('formats the resolution and the frame rate', () => {
    expect(formatResolution(1920, 1080)).toBe('1920 × 1080 px');
    expect(formatResolution(null, 1080)).toBe('—');
    expect(formatResolution(640, null)).toBe('—');
    expect(formatFrameRate({ reportedFps: 30, measuredFps: null } as WebcamFacts)).toBe(
      '30 fps reported',
    );
    expect(formatFrameRate({ reportedFps: null, measuredFps: null } as WebcamFacts)).toBe('—');
  });

  it('measures the gap between the claimed and the real frame rate', () => {
    expect(fpsDiscrepancy(30, 12)).toBe(18);
    expect(fpsDiscrepancy(30, null)).toBeNull();
    expect(fpsDiscrepancy(null, 30)).toBeNull();
  });

  it('maps a resolution request to an ideal capture size', () => {
    expect(resolutionConstraint('auto')).toBeNull();
    expect(resolutionConstraint('1280')).toEqual({ width: 1280, height: 720 });
    expect(resolutionConstraint('1920')).toEqual({ width: 1920, height: 1080 });
    expect(() => resolutionConstraint('nope')).toThrow(ToolError);
    expect(resolutionLabel('640')).toBe('640 × 360');
    expect(resolutionLabel('nope')).toBe('nope');
  });

  it('builds rows and stats for a live camera', () => {
    const facts = parseWebcamFacts(payload());
    const rows = buildReportRows(facts, { requested: 'auto', includeSettings: true });
    expect(rows.map((row) => row[0])).toEqual([
      'Status',
      'Camera',
      'Resolution',
      'Frame rate',
      'Audio',
      'Cameras detected',
      'Requested resolution',
      'Track settings',
    ]);
    expect(buildStats(facts)).toMatchObject({ cameras: 1, fps: 29.8 });
    expect(buildNotes(facts)[0]).toMatch(/recorded or stored/i);
  });

  it('parses a payload without optional fields', () => {
    const facts = parseWebcamFacts(JSON.stringify({ state: 'unsupported' }));
    expect(facts.state).toBe('unsupported');
    expect(facts.width).toBeNull();
    expect(facts.height).toBeNull();
    expect(facts.reportedFps).toBeNull();
    expect(facts.measuredFps).toBeNull();
    expect(facts.hasAudio).toBe(false);
    expect(facts.cameras).toEqual([]);
    expect(facts.settings).toBeNull();
    expect(facts.errorMessage).toBeNull();
  });

  it('accepts an empty label and a zero measured frame rate', () => {
    const facts = parseWebcamFacts(
      JSON.stringify({ ...LIVE_FACTS, cameraLabel: '', measuredFps: 0 }),
    );
    expect(facts.cameraLabel).toBe('');
    expect(facts.measuredFps).toBe(0);
    expect(formatFrameRate(facts)).toBe('30 fps reported · 0 fps measured');
  });
});
