import { describe, it, expect, vi } from 'vitest';
import { transcribeAudio, generateSRT, WhisperResult } from './speech-to-text.core';
import tool from './speech-to-text.tool';
import { ToolError } from '@/lib/types';

vi.mock('./speech-to-text.core', async () => {
  const actual = await vi.importActual('./speech-to-text.core');
  return {
    ...actual,
    transcribeAudio: vi.fn(),
  };
});

vi.mock('@/lib/ml', () => ({
  loadModel: vi.fn(),
}));

describe('speech-to-text', () => {
  it('transcribes audio and returns result', async () => {
    const mockResult: WhisperResult = {
      text: 'Hello world.',
      chunks: [
        { text: 'Hello', timestamp: [0, 1] },
        { text: 'world', timestamp: [1, 2] },
      ],
    };
    (transcribeAudio as any).mockResolvedValue(mockResult);

    const result = await transcribeAudio(new Blob(), {
      model: 'tiny',
      timestamps: true,
      language: '',
    });
    expect(result.text).toBe('Hello world.');
    expect(result.chunks).toHaveLength(2);
  });

  it('generates SRT with timestamps', () => {
    const result = {
      text: 'Hello world.',
      chunks: [
        { text: 'Hello', timestamp: [0, 1] },
        { text: 'world', timestamp: [1, 2] },
      ],
    };
    const srt = generateSRT(result);
    expect(srt).toContain('00:00:00,000 --> 00:00:01,000');
  });

  it('throws when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {}, signal: null as any })).rejects.toThrow(
      ToolError,
    );
  });
});