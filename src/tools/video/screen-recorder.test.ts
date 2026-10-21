import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { runScreenRecorder } from './screen-recorder.tool';
import { MAX_RECORDING_BYTES } from './screen-recorder.core';

const file = (name = 'screen-recording.webm', bytes = 2048, type = 'video/webm'): File =>
  new File([new Uint8Array(bytes)], name, { type });

/** A file whose reported size is faked (allocating a gigabyte is not an option). */
function fileWithSize(size: number, name = 'huge.webm', type = 'video/webm'): File {
  const f = file(name, 16, type);
  Object.defineProperty(f, 'size', { value: size, configurable: true });
  return f;
}

function rows(result: { report?: { output: string } }): Map<string, string> {
  const data = JSON.parse(result.report!.output) as { rows: string[][] };
  return new Map(data.rows as [string, string][]);
}

describe('screen-recorder meta', () => {
  it('is a beta video tool with the screen-recorder panel', () => {
    expect(tool.meta.id).toBe('screen-recorder');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.panel).toBe('screen-recorder');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers WebM by default and lists MP4 as a choice', () => {
    const format = tool.meta.options?.find((o) => o.key === 'format');
    expect(format).toBeDefined();
    expect(format?.type).toBe('select');
    expect(format?.default).toBe('webm');
    const choices = format?.type === 'select' ? format.choices : [];
    expect(choices.map((c) => c.value)).toContain('webm');
    expect(choices.map((c) => c.value)).toContain('mp4');
  });
});

describe('screen-recorder run', () => {
  it('rejects when there is no recording', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/no recording/i);
  });

  it('rejects more than one recording', async () => {
    await expect(
      tool.run({ files: [file('a.webm'), file('b.webm')], options: {} }),
    ).rejects.toThrow(/one recording at a time/i);
  });

  it('rejects an empty recording', async () => {
    await expect(tool.run({ files: [file('empty.webm', 0)], options: {} })).rejects.toThrow(
      /empty/i,
    );
  });

  it('rejects an oversized recording with a clear message', async () => {
    const promise = tool.run({
      files: [fileWithSize(MAX_RECORDING_BYTES + 1)],
      options: {},
    });
    await expect(promise).rejects.toThrow(ToolError);
    await expect(promise).rejects.toThrow(/larger than/i);
  });

  it('reports the size and duration and writes the recording out', async () => {
    const progress: number[] = [];
    const result = await runScreenRecorder({
      files: [file('screen-recording-20261021-160407.webm', 4096, 'video/webm;codecs=vp9,opus')],
      options: { duration: 12.5, microphone: true, videoBitsPerSecond: '5000000' },
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('screen-recording-20261021-160407.webm');
    expect(result.outputs[0]!.blob.size).toBe(4096);

    const table = rows(result);
    expect(table.get('File size')).toMatch(/4 KB/);
    expect(table.get('Container')).toBe('WebM (.webm)');
    expect(table.get('Duration')).toBe('12.5 s');
    expect(table.get('Microphone')).toBe('Included');
    expect(table.get('Video bitrate')).toBe('5.0 Mbps');
    expect(table.get('Recorded type')).toBe('video/webm;codecs=vp9,opus');

    expect(result.stats).toMatchObject({
      sizeBytes: 4096,
      durationSeconds: 12.5,
      format: 'webm',
      microphone: 'yes',
    });
    expect(result.warnings).toBeUndefined();
    expect(result.notes?.join(' ')).toMatch(/never uploaded/i);
    expect(progress.at(-1)).toBe(1);
  });

  it('names an MP4 recording .mp4', async () => {
    const result = await runScreenRecorder({
      files: [file('clip.mp4', 1024, 'video/mp4')],
      options: { format: 'mp4' },
    });
    expect(result.outputs[0]!.filename).toBe('clip.mp4');
    expect(rows(result).get('Container')).toBe('MP4 (H.264) (.mp4)');
    expect(result.stats?.format).toBe('mp4');
  });

  it('falls back to the file name when the type is missing', async () => {
    const result = await runScreenRecorder({
      files: [file('capture.webm', 512, '')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('capture.webm');
    expect(result.stats?.format).toBe('webm');
  });

  it('falls back to the requested format when nothing else says', async () => {
    const result = await runScreenRecorder({
      files: [file('capture', 512, '')],
      options: { format: 'mp4' },
    });
    expect(result.outputs[0]!.filename).toBe('capture.mp4');
    expect(result.stats?.format).toBe('mp4');
  });

  it('never claims MP4 when the browser recorded WebM', async () => {
    const result = await runScreenRecorder({
      files: [file('clip.webm', 512, 'video/webm')],
      options: { format: 'mp4' },
    });
    expect(result.outputs[0]!.filename).toBe('clip.webm');
    expect(result.stats?.format).toBe('webm');
    expect(result.warnings?.join(' ')).toMatch(/could not record MP4/i);
  });

  it('says the length is unknown when no duration was reported', async () => {
    const result = await runScreenRecorder({ files: [file()], options: {} });
    expect(rows(result).get('Duration')).toBe('Unknown');
    expect(result.warnings?.join(' ')).toMatch(/length of the recording is unknown/i);
    expect(result.stats?.durationSeconds).toBe(0);
  });

  it('ignores a broken duration instead of inventing one', async () => {
    const result = await runScreenRecorder({
      files: [file()],
      options: { duration: 'nonsense' },
    });
    expect(rows(result).get('Duration')).toBe('Unknown');
  });

  it('warns when the container cannot be confirmed', async () => {
    const result = await runScreenRecorder({
      files: [file('capture', 512, '')],
      options: {},
    });
    expect(result.warnings?.join(' ')).toMatch(/could not be confirmed/i);
  });

  it('keeps a Unicode file name intact', async () => {
    const name = 'презентация 日本語 🎥.webm';
    const result = await runScreenRecorder({ files: [file(name, 512)], options: {} });
    expect(result.outputs[0]!.filename).toBe(name);
    expect(rows(result).get('File name')).toBe(name);
  });

  it('honours an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runScreenRecorder({ files: [file()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
  });
});
