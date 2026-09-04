import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-csv.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; language?: string };

describe('json-to-csv', () => {
  it('converts an array of objects with a header row by default', () => {
    expect(
      run('[{ "name": "Ada", "role": "dev" }, { "name": "Linus", "role": "ops" }]').output,
    ).toBe('name,role\nAda,dev\nLinus,ops');
  });

  it('unions keys across rows, leaving missing cells empty', () => {
    expect(run('[{ "a": 1 }, { "b": 2 }]').output).toBe('a,b\n1,\n,2');
  });

  it('flattens nested objects to dotted keys when flatten is on', () => {
    expect(run('[{ "id": 1, "user": { "name": "Ada", "city": "London" } }]').output).toBe(
      'id,user.name,user.city\n1,Ada,London',
    );
  });

  it('serialises nested objects as JSON when flatten is off', () => {
    expect(run('[{ "id": 1, "user": { "name": "Ada" } }]', { flatten: false }).output).toBe(
      'id,user\n1,"{""name"":""Ada""}"',
    );
  });

  it('omits the header row when header is false', () => {
    expect(run('[{ "a": 1, "b": 2 }]', { header: false }).output).toBe('1,2');
  });

  it('supports the semicolon, tab, and pipe delimiters', () => {
    expect(run('[{ "a": 1, "b": 2 }]', { delimiter: 'semicolon' }).output).toBe('a;b\n1;2');
    expect(run('[{ "a": 1, "b": 2 }]', { delimiter: 'tab' }).output).toBe('a\tb\n1\t2');
    expect(run('[{ "a": 1, "b": 2 }]', { delimiter: 'pipe' }).output).toBe('a|b\n1|2');
  });

  it('quotes fields containing the delimiter, quotes, or newlines', () => {
    expect(run('[{ "v": "a,b" }]').output).toBe('v\n"a,b"');
    expect(run('[{ "v": "say \\"hi\\"" }]').output).toBe('v\n"say ""hi"""');
    expect(run('[{ "v": "l1\\nl2" }]').output).toBe('v\n"l1\nl2"');
  });

  it('accepts an array of arrays', () => {
    expect(run('[["a", "b"], [1, 2]]').output).toBe('a,b\n1,2');
  });

  it('renders null as empty and keeps primitives', () => {
    expect(run('[{ "a": null, "b": true, "c": 0 }]').output).toBe('a,b,c\n,true,0');
  });

  it('returns empty output for empty input or an empty array', () => {
    expect(run('').output).toBe('');
    expect(run('[]').output).toBe('');
  });

  it('sets a csv code language', () => {
    expect(run('[{ "a": 1 }]').language).toBe('csv');
  });

  it('throws ToolError on invalid JSON, a non-array, or a non-object row', () => {
    expect(() => run('[{ bad json }]')).toThrow(ToolError);
    expect(() => run('{ "a": 1 }')).toThrow(ToolError);
    expect(() => run('[1, 2, 3]')).toThrow(ToolError);
  });
});
