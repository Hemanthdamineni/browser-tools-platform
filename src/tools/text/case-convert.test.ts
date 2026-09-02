import { describe, it, expect } from 'vitest';
import tool from './case-convert.tool';
import { toWords } from './case-convert.tool';

const c = (text: string, target: string) =>
  (tool.run({ text, options: { target } }) as { output: string }).output;

describe('case-convert', () => {
  it('upper / lower', () => {
    expect(c('Hello World', 'upper')).toBe('HELLO WORLD');
    expect(c('Hello World', 'lower')).toBe('hello world');
  });
  it('title / sentence', () => {
    expect(c('hello wORLD', 'title')).toBe('Hello World');
    expect(c('hi. bye! ok? yes', 'sentence')).toBe('Hi. Bye! Ok? Yes');
  });
  it('camel / pascal from snake', () => {
    expect(c('user_id_value', 'camel')).toBe('userIdValue');
    expect(c('user_id_value', 'pascal')).toBe('UserIdValue');
  });
  it('snake / kebab / constant from camel', () => {
    expect(c('myVariableName', 'snake')).toBe('my_variable_name');
    expect(c('myVariableName', 'kebab')).toBe('my-variable-name');
    expect(c('myVariableName', 'constant')).toBe('MY_VARIABLE_NAME');
  });
  it('splits acronym boundaries', () => {
    expect(toWords('MyHTTPServer')).toEqual(['My', 'HTTP', 'Server']);
    expect(c('parseHTTPResponse', 'kebab')).toBe('parse-http-response');
  });
  it('inverse and alternating', () => {
    expect(c('Hello', 'inverse')).toBe('hELLO');
    expect(c('abcd', 'alternating')).toBe('aBcD');
  });
  it('empty input', () => {
    expect(c('', 'title')).toBe('');
  });
});
