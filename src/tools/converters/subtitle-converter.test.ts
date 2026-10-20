import { describe, expect, it } from 'vitest';
import tool from './subtitle-converter.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('subtitle-converter', () => {
  it('converts SRT to VTT with header and dot timestamps', async () => {
    const r = await run(
      '1\n00:00:01,500 --> 00:00:04,000\nWelcome back!\n\n2\n00:00:05,000 --> 00:00:06,500\nLet us begin.',
    );
    expect(r.output).toBe(
      'WEBVTT\n\n00:00:01.500 --> 00:00:04.000\nWelcome back!\n\n00:00:05.000 --> 00:00:06.500\nLet us begin.\n',
    );
    expect(r.stats?.cues).toBe(2);
  });

  it('converts VTT to SRT with numbering and comma timestamps', async () => {
    const r = await run(
      'WEBVTT\n\n00:00:01.500 --> 00:00:04.000\nHi there.\n\n00:00:05.000 --> 00:00:06.500 align:start\nBye!',
      {
        target: 'srt',
      },
    );
    expect(r.output).toBe(
      '1\n00:00:01,500 --> 00:00:04,000\nHi there.\n\n2\n00:00:05,000 --> 00:00:06,500\nBye!\n',
    );
  });

  it('auto-detects and converts to the other format', async () => {
    const fromSrt = await run('1\n00:00:00,000 --> 00:00:01,000\nx');
    expect(fromSrt.output).toContain('WEBVTT');
    const fromVtt = await run('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nx');
    expect(fromVtt.output).toMatch(/^1\n00:00:00,000 --> 00:00:01,000/);
  });

  it('shifts cues by seconds', async () => {
    const r = await run('1\n00:00:01,000 --> 00:00:02,000\nHello', { shift: 2.5, target: 'srt' });
    expect(r.output).toContain('00:00:03,500 --> 00:00:04,500');
    const back = await run('1\n00:00:05,000 --> 00:00:06,000\nHello', {
      shift: -1.5,
      target: 'srt',
    });
    expect(back.output).toContain('00:00:03,500 --> 00:00:04,500');
  });

  it('clamps negative starts and drops cues pushed entirely past zero', async () => {
    const r = await run(
      '1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:07,000\nB',
      { shift: -3, target: 'srt' },
    );
    expect(r.output).toContain('00:00:00,000 --> 00:00:04,000');
    expect(r.output).not.toContain('\nA\n');
    expect(r.output).toContain('\nB\n');
    expect(r.stats?.cues).toBe(1);
  });

  it('preserves multi-line cue text', async () => {
    const r = await run('1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two');
    expect(r.output).toContain('Line one\nLine two');
  });

  it('round-trips SRT through VTT and back', async () => {
    const srt =
      '1\n00:00:01,500 --> 00:00:04,000\nWelcome back!\n\n2\n00:00:05,000 --> 00:00:06,500\nLet us begin.';
    const vtt = (await run(srt)).output;
    const back = (await run(vtt, { target: 'srt' })).output;
    expect(back).toBe(srt + '\n');
  });

  it('rejects empty input and files with no cue timestamps', async () => {
    await expect(run('   ')).rejects.toThrow(/paste an srt/i);
    await expect(run('plain text, no timestamps')).rejects.toThrow(/no subtitle cues/i);
  });

  it('re-renders a copy when input already matches target', async () => {
    const r = await run('1\n00:00:01,000 --> 00:00:02,000\nHello', { target: 'srt' });
    expect(r.notes?.join(' ')).toMatch(/already srt/i);
    expect(r.output.startsWith('1\n')).toBe(true);
  });
});
