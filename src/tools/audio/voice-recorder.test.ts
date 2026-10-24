import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { runVoiceRecorder } from './voice-recorder.tool';

const file = (name = 'voice-recording.wav', bytes = 2048, type = 'audio/wav'): File =>
  new File([new Uint8Array(bytes)], name, { type });

/** A file whose reported size is faked (allocating a gigabyte is not an option). */
function fileWithSize(size: number, name = 'huge.webm'): File {
  const f = file(name, 16, 'audio/webm');
  Object.defineProperty(f, 'size', { value: size, configurable: true });
  return f;
}

describe('voice-recorder meta', () => {
  it('is a stable audio tool with the voice-recorder panel', () => {
    expect(tool.meta.id).toBe('voice-recorder');
    expect(tool.meta.category).toBe('audio');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.panel).toBe('voice-recorder');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers WAV by default and lists WebM as a choice', () => {
    const format = tool.meta.options?.find((o) => o.key === 'format');
    expect(format).toBeDefined();
    expect(format?.default).toBe('wav');
    const choices = format?.type === 'select' ? format.choices : [];
    expect(choices.map((c) => c.value)).toEqual(['wav', 'webm']);
  });

  it('links to the audio trim tool', () => {
    expect(tool.meta.related).toContain('audio-trim');
  });
});

describe('voice-recorder run', () => {
  it('rejects when there is no take', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/record a take/i);
  });

  it('rejects more than one take', async () => {
    await expect(
      tool.run({ files: [file('a.wav'), file('b.wav')], options: {} }),
    ).rejects.toThrow(/one recording at a time/i);
  });

  it('rejects an empty take', async () => {
    await expect(tool.run({ files: [file('empty.wav', 0)], options: {} })).rejects.toThrow(
      /empty/i,
    );
  });

  it('rejects an oversized take with a clear message', async () => {
    await expect(
      tool.run({ files: [fileWithSize(1024 * 1024 * 1024 + 1)], options: {} }),
    ).rejects.toThrow(/too large/i);
  });

  it('passes a WAV take through with a .wav name', async () => {
    const result = await runVoiceRecorder({
      files: [file('voice-recording-20261024-090503.wav', 4096, 'audio/wav')],
      options: { format: 'wav', duration: 12.5 },
    });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('voice-recording-20261024-090503.wav');
    expect(result.outputs[0]!.blob.size).toBe(4096);
    expect(result.stats?.format).toBe('wav');
    expect(result.stats?.sizeLabel).toMatch(/4 KB/);
    expect(result.stats?.durationSeconds).toBe(12.5);
    expect(result.notes?.join(' ')).toMatch(/WAV/i);
    expect(result.notes?.join(' ')).toMatch(/never uploaded/i);
  });

  it('passes a WebM take through as WebM', async () => {
    const result = await runVoiceRecorder({
      files: [file('memo.webm', 1024, 'audio/webm;codecs=opus')],
      options: { format: 'webm' },
    });
    expect(result.outputs[0]!.filename).toBe('memo.webm');
    expect(result.stats?.format).toBe('webm');
    expect(result.notes?.join(' ')).toMatch(/WebM/i);
  });

  it('falls back to the requested format when the file says nothing', async () => {
    const result = await runVoiceRecorder({
      files: [file('take', 512, '')],
      options: { format: 'wav' },
    });
    expect(result.outputs[0]!.filename).toBe('take');
    expect(result.stats?.format).toBe('wav');
  });

  it('never claims WebM when the take is WAV', async () => {
    const result = await runVoiceRecorder({
      files: [file('take.wav', 512, 'audio/wav')],
      options: { format: 'webm' },
    });
    expect(result.stats?.format).toBe('wav');
    expect(result.notes?.join(' ')).toMatch(/WAV/i);
  });

  it('reports a duration of 0 when none was given', async () => {
    const result = await runVoiceRecorder({ files: [file()], options: {} });
    expect(result.stats?.durationSeconds).toBe(0);
  });
});