import { describe, it, expect } from 'vitest';
import type { OptionValues, TextRunResult } from '@/lib/types';
import tool, { runTextToSpeech, type TextToSpeechInput } from './text-to-speech.tool';

/** Call the tool with the options omitted, the way a bare test would. */
const run = (text: string, options: OptionValues = {}) => runTextToSpeech({ text, options });

/** Parse the JSON plan the tool returns as its `output`. */
const plan = (text: string, options: OptionValues = {}) =>
  JSON.parse(run(text, options).output) as {
    text: string;
    voice: string | null;
    rate: number;
    pitch: number;
    volume: number;
    characters: number;
    words: number;
    truncated: boolean;
  };

describe('text-to-speech', () => {
  it('builds a speech plan with the default settings', () => {
    const result = run('Hello world');
    const parsed = plan('Hello world');
    expect(parsed.text).toBe('Hello world');
    expect(parsed.voice).toBeNull();
    expect(parsed.rate).toBe(1);
    expect(parsed.pitch).toBe(1);
    expect(parsed.volume).toBe(1);
    expect(parsed.characters).toBe(11);
    expect(parsed.words).toBe(2);
    expect(result.render).toBe('code');
    expect(result.language).toBe('json');
    expect(result.stats?.words).toBe(2);
  });

  it('returns a plan even when options are omitted entirely', () => {
    const result = runTextToSpeech({ text: 'abc' } satisfies TextToSpeechInput);
    expect(JSON.parse(result.output).rate).toBe(1);
  });

  it('rejects empty input with a ToolError hint', () => {
    expect(() => run('')).toThrow(/Enter some text to speak/i);
    expect(() => run('   \n  ')).toThrow(/Enter some text to speak/i);
  });

  it('clamps rate, pitch and volume into the engine’s range', () => {
    const hot = plan('x', { rate: 20, pitch: 5, volume: 3 });
    expect(hot.rate).toBe(10);
    expect(hot.pitch).toBe(2);
    expect(hot.volume).toBe(1);

    const cold = plan('x', { rate: 0.01, pitch: -4, volume: -1 });
    expect(cold.rate).toBe(0.1);
    expect(cold.pitch).toBe(0);
    expect(cold.volume).toBe(0);
  });

  it('rounds a chosen voice through to the plan', () => {
    const parsed = plan('hi', { voice: 'com.apple.voice.compact.en-US.Samantha' });
    expect(parsed.voice).toBe('com.apple.voice.compact.en-US.Samantha');
  });

  it('trims very long text and warns about the trim', () => {
    const long = 'a'.repeat(5001);
    const result = run(long);
    const parsed = JSON.parse(result.output) as { text: string; truncated: boolean };
    expect(parsed.truncated).toBe(true);
    expect(parsed.text.length).toBe(5000);
    expect(result.warnings?.join(' ')).toMatch(/cut to 5,000 characters/i);
  });

  it('does not warn for text at the limit', () => {
    const result = run('a'.repeat(5000));
    expect(result.warnings).toBeUndefined();
    expect(JSON.parse(result.output).truncated).toBe(false);
  });

  it('names the browser default when no voice is chosen', () => {
    const result = run('hello');
    expect(result.notes?.join(' ')).toMatch(/default voice/i);
  });

  it('exposes the default export as a text tool module', () => {
    expect(tool.meta.id).toBe('text-to-speech');
    expect(typeof tool.run).toBe('function');
    expect(runTextToSpeech({ text: 'ok' } satisfies TextToSpeechInput)).toEqual(
      tool.run({ text: 'ok' } satisfies TextToSpeechInput),
    );
  });
});