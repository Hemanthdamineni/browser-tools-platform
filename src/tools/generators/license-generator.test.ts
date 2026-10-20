import { describe, expect, it } from 'vitest';
import tool from './license-generator.tool';

type Result = { output: string; notes?: string[]; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('license-generator', () => {
  it('produces MIT with a header containing year and name', async () => {
    const r = await run('', { license: 'MIT', year: '2024', fullname: 'Ada Lovelace' });
    expect(r.output).toContain('Copyright (c) 2024 Ada Lovelace');
    expect(r.output).toContain('Permission is hereby granted');
    expect(r.output).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it('uses current year when the sentinel default is passed', async () => {
    const r = await run('', { license: 'ISC', year: '<current year>', fullname: 'Ada' });
    const thisYear = String(new Date().getFullYear());
    expect(r.output).toContain('Copyright (c) ' + thisYear + ', Ada');
  });

  it('emits BSD-2 and BSD-3 distinct texts', async () => {
    const b2 = await run('', { license: 'BSD-2-Clause', year: '2024', fullname: 'Ada' });
    expect(b2.output).toContain('Redistribution and use in source and binary forms');
    expect(b2.output).not.toContain('Neither the name of the copyright holder');
    const b3 = await run('', { license: 'BSD-3-Clause', year: '2024', fullname: 'Ada' });
    expect(b3.output).toContain('Neither the name of the copyright holder');
  });

  it('emits headerless licenses without a copyright line', async () => {
    const u = await run('', { license: 'Unlicense' });
    expect(u.output).not.toMatch(/copyright \(c\)/i);
    expect(u.output).toContain(
      'This is free and unencumbered software released into the public domain',
    );
    const c = await run('', { license: 'CC0-1.0', year: '2025', fullname: 'Ada' });
    expect(c.output).toContain('CC0 1.0 Universal');
    expect(c.output).toContain('Statement of Purpose');
  });

  it('emits an apache text with the copyright header', async () => {
    const a = await run('', { license: 'Apache-2.0', year: '2024', fullname: 'Ada' });
    expect(a.output).toContain('Apache License');
    expect(a.output).toContain('Copyright 2024 Ada');
  });

  it('defaults the year and placeholders', async () => {
    const r = await run('', { license: 'MIT' });
    expect(r.output).toContain(String(new Date().getFullYear()));
    expect(r.output).toContain('<your name>');
  });

  it('rejects an unknown license', async () => {
    await expect(run('', { license: 'GPL-3.0' })).rejects.toThrow(/unknown license/i);
  });
});
