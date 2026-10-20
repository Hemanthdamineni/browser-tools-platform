import { describe, expect, it } from 'vitest';
import tool from './json-to-java.tool';

type Result = { output: string; render?: string; language?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-java', () => {
  it('generates a POJO with getters and setters', async () => {
    const r = await run('{"id":1,"name":"Ada","active":true}', { className: 'User' });
    const o = r.output;
    expect(o).toContain('public class User {');
    expect(o).toContain('private Integer id;');
    expect(o).toContain('private String name;');
    expect(o).toContain('private Boolean active;');
    expect(o).toContain('public Integer getId() {');
    expect(o).toContain('public void setName(String name) {');
    expect(o).toContain('import java.util.List;');
  });

  it('infers Long and Double correctly', async () => {
    const r = await run('{"big":9007199254740991,"price":9.99}', { className: 'Money' });
    expect(r.output).toContain('private Long big;');
    expect(r.output).toContain('private Double price;');
  });

  it('camelCases keys and escapes reserved words', async () => {
    const r = await run('{"user_name":"x","user-name":"y","class":1}', { className: 'T' });
    expect(r.output).toContain('private String userName;');
    expect(r.output).toContain('private Integer class_;');
  });

  it('nests objects as static classes and arrays as List', async () => {
    const r = await run('{"address":{"city":"Paris"},"tags":["a","b"]}', { className: 'Person' });
    const o = r.output;
    expect(o).toContain('private Address address;');
    expect(o).toContain('private List<String> tags;');
    expect(o).toContain('public static class Address {');
    expect(o).toContain('private String city;');
  });

  it('emits Lombok @Data style', async () => {
    const r = await run('{"id":1}', { className: 'T', style: 'lombok' });
    expect(r.output).toContain('import lombok.Data;');
    expect(r.output).toContain('@Data');
    expect(r.output).toContain('private Integer id;');
    expect(r.output).not.toContain('getId()');
  });

  it('emits Java records including nested types', async () => {
    const r = await run('{"id":1,"meta":{"ok":true}}', { className: 'R', style: 'record' });
    const o = r.output;
    expect(o).toContain('public record R(Integer id, Meta meta) {');
    expect(o).toContain('public record Meta(Boolean ok) {}');
  });

  it('honours package name and primitive option', async () => {
    const r = await run('{"id":1,"flag":true}', {
      className: 'T',
      packageName: 'com.example',
      useWrapperTypes: false,
    });
    expect(r.output.startsWith('package com.example;\n')).toBe(true);
    expect(r.output).toContain('private int id;');
    expect(r.output).toContain('private boolean flag;');
  });

  it('rejects invalid input', async () => {
    await expect(run('', {})).rejects.toThrow(/paste json/i);
    await expect(run('nope', {})).rejects.toThrow(/invalid json/i);
    await expect(run('"str"', {})).rejects.toThrow(/object/i);
    await expect(run('[]', {})).rejects.toThrow(/empty/i);
    await expect(run('{}', {})).rejects.toThrow(/no fields/i);
  });
});
