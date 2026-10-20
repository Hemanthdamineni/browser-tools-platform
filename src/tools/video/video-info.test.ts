import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { VideoProbe, VideoProbeOptions } from '@/lib/video';
import tool, { runVideoInfo, type VideoProbeFn } from './video-info.tool';

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

function probeResult(overrides: Partial<VideoProbe> = {}): VideoProbe {
  return {
    fileName: 'clip.mp4',
    fileSize: 1024,
    format: 'MP4',
    formatMime: 'video/mp4',
    mimeType: 'video/mp4; codecs="avc1.640028"',
    durationSeconds: 42.5,
    durationFromMetadata: true,
    webCodecs: true,
    videoTracks: [
      {
        index: 0,
        codec: 'avc',
        codecString: 'avc1.640028',
        codedWidth: 1280,
        codedHeight: 720,
        displayWidth: 1280,
        displayHeight: 720,
        rotation: 0,
        frameRate: 30,
        averageBitrate: 2_500_000,
        decodable: true,
        language: null,
      },
    ],
    audioTracks: [],
    tags: null,
    ...overrides,
  };
}

describe('video-info meta', () => {
  it('is a beta file tool in the video category with a credited engine', () => {
    expect(tool.meta.id).toBe('video-info');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(tool.meta.credits?.[0]).toMatchObject({ name: 'mediabunny', license: 'MPL-2.0' });
  });
});

describe('video-info run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects a multi-file selection', async () => {
    const probe = vi.fn();
    await expect(
      runVideoInfo({ files: [file('a.mp4'), file('b.mp4')], options: {} }, probe),
    ).rejects.toThrow(/one video file/i);
    expect(probe).not.toHaveBeenCalled();
  });

  it('builds a table report and passes resolved options to the engine', async () => {
    const calls: { file: File; options?: VideoProbeOptions }[] = [];
    const probe: VideoProbeFn = async (f, options) => {
      calls.push({ file: f, options });
      options?.onProgress?.(1, 'Done');
      return probeResult({ tags: { title: 'Roadtrip' } });
    };

    const progress: number[] = [];
    const result = await runVideoInfo(
      {
        files: [file('roadtrip.mp4')],
        options: { scanFrames: true, readTags: false, checkDecode: false },
        onProgress: (fraction) => progress.push(fraction),
      },
      probe,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.file.name).toBe('roadtrip.mp4');
    expect(calls[0]!.options).toMatchObject({
      scanFrames: true,
      readTags: false,
      checkDecode: false,
    });
    expect(typeof calls[0]!.options?.onProgress).toBe('function');

    expect(result.outputs).toEqual([]);
    expect(result.report?.render).toBe('table');
    const report = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.headers).toEqual(['Property', 'Value']);
    const map = new Map(report.rows as [string, string][]);
    expect(map.get('Video track 1 · Resolution')).toBe('1280 × 720');
    expect(map.get('Video track 1 · Frame rate')).toBe('30 fps');
    expect(map.get('Video track 1 · Bitrate')).toBe('2.50 Mbps');
    expect(map.get('Video track 1 · Decodable here')).toBe('Yes');

    expect(result.stats).toMatchObject({
      videoTracks: 1,
      audioTracks: 0,
      width: 1280,
      height: 720,
      sizeBytes: 1024,
    });
    expect(result.warnings).toBeUndefined();
    expect(progress.at(-1)).toBe(1);
  });

  it('applies the declared defaults when options are omitted', async () => {
    let seen: VideoProbeOptions | undefined;
    const probe: VideoProbeFn = async (_f, options) => {
      seen = options;
      return probeResult();
    };
    await runVideoInfo({ files: [file()], options: {} }, probe);
    expect(seen).toMatchObject({ scanFrames: false, readTags: true, checkDecode: true });
  });

  it('warns when the duration is missing or WebCodecs is unavailable', async () => {
    const probe: VideoProbeFn = async () =>
      probeResult({
        durationSeconds: null,
        durationFromMetadata: false,
        webCodecs: false,
        videoTracks: [{ ...probeResult().videoTracks[0]!, decodable: false }],
      });
    const result = await runVideoInfo({ files: [file()], options: {} }, probe);
    expect(result.warnings?.join(' ')).toMatch(/duration could not be read/i);
    expect(result.warnings?.join(' ')).toMatch(/no WebCodecs/i);
    // Only one WebCodecs warning — a non-decodable track must not be reported twice.
    expect(result.warnings?.filter((w) => /decode/i.test(w))).toHaveLength(1);
    expect(result.notes?.join(' ')).toMatch(/duration: unknown/i);
  });

  it('keeps Unicode filenames intact in the report', async () => {
    const probe: VideoProbeFn = async (f) => probeResult({ fileName: f.name });
    const name = 'презентация 日本語 🎥.mkv';
    const result = await runVideoInfo({ files: [file(name)], options: {} }, probe);
    const report = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(report.rows.find((r) => r[0] === 'File name')?.[1]).toBe(name);
  });

  it('propagates engine failures such as a non-video file', async () => {
    const probe: VideoProbeFn = async () => {
      throw new ToolError('This file has no video track.', 'It looks like an audio file.');
    };
    await expect(runVideoInfo({ files: [file('song.mp3')], options: {} }, probe)).rejects.toThrow(
      /no video track/i,
    );
  });

  it('validates empty files through the real engine path without loading it', async () => {
    await expect(runVideoInfo({ files: [file('empty.mp4', 0)], options: {} })).rejects.toThrow(
      /empty/i,
    );
  });
});
