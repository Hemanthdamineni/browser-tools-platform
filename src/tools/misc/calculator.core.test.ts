import { describe, it, expect } from 'vitest';
import {
  CONSTANTS,
  evaluateExpression,
  formatNumber,
  FUNCTIONS,
  PRECEDENCE,
} from './calculator.core';
import { ToolError } from '@/lib/types';

const evalRad = (src: string) => evaluateExpression(src, { degrees: false });
const evalDeg = (src: string) => evaluateExpression(src, { degrees: true });

describe('calculator core — scientific functions', () => {
  it('evaluates each function the keypad surfaces', () => {
    expect(evalRad('sin(pi/2)')).toBe(1);
    expect(evalRad('cos(0)')).toBe(1);
    expect(evalRad('log10(1000)')).toBe(3);
    expect(evalRad('log(1000)')).toBe(3);
    expect(evalRad('ln(e)')).toBe(1);
    expect(evalRad('log2(8)')).toBe(3);
    expect(evalRad('sqrt(144)')).toBe(12);
    expect(evalRad('cbrt(27)')).toBe(3);
    expect(evalRad('5!')).toBe(120);
    expect(evalRad('factorial(5)')).toBe(120);
    expect(evalRad('2^10')).toBe(1024);
    expect(evalRad('exp(0)')).toBe(1);
    expect(evalRad('abs(-7)')).toBe(7);
    expect(evalRad('gcd(12, 18)')).toBe(6);
    expect(evalRad('hypot(3, 4)')).toBe(5);
  });

  it('uses the angle mode for the trigonometric functions', () => {
    expect(evalDeg('sin(90)')).toBeCloseTo(1, 12);
    expect(evalDeg('asin(1)')).toBeCloseTo(90, 12);
    expect(evalRad('asin(1)')).toBeCloseTo(Math.PI / 2, 12);
  });

  it('reads the constants from the constant table', () => {
    expect(evalRad('pi')).toBe(CONSTANTS.pi);
    expect(evalRad('e')).toBe(CONSTANTS.e);
  });
});

describe('calculator core — precedence', () => {
  it('multiplies before it adds', () => {
    expect(evalRad('2+3*4')).toBe(14);
    expect(evalRad('(2+3)*4')).toBe(20);
    expect(evalRad('10-6/2')).toBe(7);
    expect(evalRad('10%3')).toBe(1);
  });

  it('binds exponentiation tighter than unary minus', () => {
    // The grammar parses the exponent as a unary/power expression and the base
    // as a postfix expression, so a leading minus applies to the finished
    // power: `-3^2` is `-(3^2)` = -9 (NOT 9) — this is the defined behaviour.
    expect(evalRad('-3^2')).toBe(-9);
    expect(evalRad('(-3)^2')).toBe(9);
    expect(evalRad('2^-2')).toBe(0.25);
  });

  it('is right-associative for powers', () => {
    expect(evalRad('2^3^2')).toBe(512);
    expect(evalRad('2^(3^2)')).toBe(512);
  });

  it('binds the postfix factorial tightest', () => {
    expect(evalRad('2^3!')).toBe(64); // 2^(3!) = 2^6
    expect(evalRad('3!+1')).toBe(7);
  });

  it('documents precedence tightest-first and derives the operator set from it', () => {
    const levelOf = (op: string) => PRECEDENCE.find((p) => p.ops.includes(op))?.level ?? -1;
    expect(levelOf('!')).toBeLessThan(levelOf('^'));
    expect(levelOf('^')).toBeLessThan(levelOf('*'));
    expect(levelOf('*')).toBeLessThan(levelOf('+'));
    expect(levelOf('+')).toBe(levelOf('-'));
  });
});

describe('calculator core — the function registry', () => {
  it('has a label, an insert and a callable implementation for every entry', () => {
    for (const [name, fn] of Object.entries(FUNCTIONS)) {
      expect(fn.label, `${name} label`).toBeTruthy();
      expect(fn.insert, `${name} insert`).toMatch(/\($/);
      expect(fn.minArgs, `${name} minArgs`).toBeGreaterThanOrEqual(1);
      expect(typeof fn.call, `${name} call`).toBe('function');
    }
  });

  it('exposes the scientific functions the keypad row shows', () => {
    const scientific = Object.entries(FUNCTIONS)
      .filter(([, fn]) => fn.scientific)
      .map(([name]) => name);
    for (const name of ['sin', 'cos', 'tan', 'ln', 'log10', 'log2', 'exp', 'sqrt', 'cbrt']) {
      expect(scientific, `missing ${name}`).toContain(name);
    }
  });

  it('carries the constant table', () => {
    expect(CONSTANTS.pi).toBeCloseTo(Math.PI, 12);
    expect(CONSTANTS.e).toBeCloseTo(Math.E, 12);
  });
});

describe('calculator core — guards and errors', () => {
  it('returns null for input that carries no tokens', () => {
    expect(evalRad('')).toBeNull();
    expect(evalRad('   ')).toBeNull();
    expect(evalRad('_')).toBeNull();
  });

  it('rejects unknown names, bad syntax and out-of-domain arguments', () => {
    expect(() => evalRad('unknown(2)')).toThrow(ToolError);
    expect(() => evalRad('globalThis')).toThrow(/Unknown value or function/);
    expect(() => evalRad('2 +')).toThrow(ToolError);
    expect(() => evalRad('sqrt(-1)')).toThrow(/non-negative/);
    expect(() => evalRad('log10(0)')).toThrow(/positive/);
    expect(() => evalRad('ln(-1)')).toThrow(/positive/);
    expect(() => evalRad('asin(2)')).toThrow(/between -1 and 1/);
    expect(() => evalRad('1/0')).toThrow(/divide by zero/);
    expect(() => evalRad('1%0')).toThrow(/modulo by zero/);
    expect(() => evalRad('(-5)!')).toThrow(/non-negative integer/);
    expect(() => evalRad('20!')).toThrow(/too large/);
  });

  it('rejects functions called with too few arguments', () => {
    expect(() => evalRad('sqrt()')).toThrow(/at least one argument/);
    expect(() => evalRad('pow(2)')).toThrow(/at least 2 arguments/);
    expect(() => evalRad('atan2(1)')).toThrow(/at least 2 arguments/);
  });

  it('never evaluates code from the expression', () => {
    expect(() => evalRad('Function("return 1")()')).toThrow(ToolError);
    expect(() => evalRad('constructor')).toThrow(ToolError);
    expect(() => evalRad('process')).toThrow(ToolError);
  });

  it('produces non-finite results that the caller must reject', () => {
    expect(Number.isFinite(evalRad('10^400')!)).toBe(false);
    expect(() => formatNumber(evalRad('10^400')!, 10)).toThrow(/finite/i);
  });
});

describe('calculator core — number formatting', () => {
  it('keeps integers exact and trims trailing zeros', () => {
    expect(formatNumber(1024, 10)).toBe('1024');
    expect(formatNumber(-9, 10)).toBe('-9');
    expect(formatNumber(0.25, 10)).toBe('0.25');
    expect(formatNumber(1 / 3, 3)).toBe('0.333');
    expect(formatNumber(1.5, 0)).toBe('2');
  });
});
