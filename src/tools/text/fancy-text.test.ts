import { describe, it, expect } from 'vitest';
import tool from './fancy-text.tool';

describe('fancy-text', () => {
  it('converts to bold style', async () => {
    const res = await tool.run({ text: 'Hello', options: { style: 'bold' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('𝐇𝐞𝐥𝐥𝐨');
  });

  it('converts to italic style', async () => {
    const res = await tool.run({ text: 'Hello', options: { style: 'italic' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('𝐻𝑒𝑙𝑙𝑜');
  });

  it('converts to script style', async () => {
    const res = await tool.run({ text: 'ABC', options: { style: 'script' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('𝒜𝒝𝒞');
  });

  it('converts to fraktur style', async () => {
    const res = await tool.run({ text: 'ABC', options: { style: 'fraktur' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('𝔄𝔅𝔆');
  });

  it('converts to double-struck style', async () => {
    const res = await tool.run({ text: 'ABC123', options: { style: 'double-struck' } });
    expect(res.render).toBe('code');
    // Double-struck: A=𝔸, B=𝔹, C=𝔺, 1=𝟣, 2=𝟤, 3=𝟥
    expect(res.output).toBe('𝔸𝔹𝔺𝟣𝟤𝟥');
  });

  it('converts to monospace style', async () => {
    const res = await tool.run({ text: 'ABC123', options: { style: 'monospace' } });
    expect(res.render).toBe('code');
    // Monospace: A=𝙰, B=𝙱, C=𝙲, 1=𝟷, 2=𝟸, 3=𝟹
    expect(res.output).toBe('𝙰𝙱𝙲𝟷𝟸𝟹');
  });

  it('converts to sans-serif bold', async () => {
    const res = await tool.run({ text: 'Hello', options: { style: 'sans-serif-bold' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('𝗛𝗲𝗹𝗹𝗼');
  });

  it('converts to circled style', async () => {
    const res = await tool.run({ text: 'ABC123', options: { style: 'circled' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('ⒶⒷⒸ①②③');
  });

  it('converts to fullwidth style', async () => {
    const res = await tool.run({ text: 'Hello!', options: { style: 'fullwidth' } });
    expect(res.render).toBe('code');
    expect(res.output).toBe('Ｈｅｌｌｏ！');
  });

  it('leaves unsupported characters unchanged', async () => {
    const res = await tool.run({ text: 'Hello 😀 World', options: { style: 'bold' } });
    expect(res.render).toBe('code');
    expect(res.output).toContain('😀');
  });

  it('handles empty input', async () => {
    const res = await tool.run({ text: '', options: { style: 'bold' } });
    expect(res.output).toBe('');
  });

  it('includes stats', async () => {
    const res = await tool.run({ text: 'Hello', options: { style: 'bold' } });
    expect(res.stats).toBeDefined();
    expect(res.stats?.['characters changed']).toBe(5);
    expect(res.stats?.['characters total']).toBe(5);
  });
});