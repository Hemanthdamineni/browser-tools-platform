import { describe, it, expect } from 'vitest';
import tool from './case-convert.tool';
import { toWords } from './case-convert.tool';

const c = async (text: string, target: string) =>
  (await tool.run({ text, options: { target } }) as { output: string }).output;

describe('case-convert', async () => {
  it('upper / lower', async () => {
    expect(await c('Hello World', 'upper')).toBe('HELLO WORLD');
    expect(await c('Hello World', 'lower')).toBe('hello world');
  });
  it('title / sentence', async () => {
    expect(await c('hello wORLD', 'title')).toBe('Hello World');
    expect(await c('hi. bye! ok? yes', 'sentence')).toBe('Hi. Bye! Ok? Yes');
  });
  it('camel / pascal from snake', async () => {
    expect(await c('user_id_value', 'camel')).toBe('userIdValue');
    expect(await c('user_id_value', 'pascal')).toBe('UserIdValue');
  });
  it('snake / kebab / constant from camel', async () => {
    expect(await c('myVariableName', 'snake')).toBe('my_variable_name');
    expect(await c('myVariableName', 'kebab')).toBe('my-variable-name');
    expect(await c('myVariableName', 'constant')).toBe('MY_VARIABLE_NAME');
  });
  it('splits acronym boundaries', async () => {
    expect(toWords('MyHTTPServer')).toEqual(['My', 'HTTP', 'Server']);
    expect(await c('parseHTTPResponse', 'kebab')).toBe('parse-http-response');
  });
  it('inverse and alternating', async () => {
    expect(await c('Hello', 'inverse')).toBe('hELLO');
    expect(await c('abcd', 'alternating')).toBe('aBcD');
  });
  it('empty input', async () => {
    expect(await c('', 'title')).toBe('');
  });
});