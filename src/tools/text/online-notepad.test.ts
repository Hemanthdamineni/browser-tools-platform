import { describe, it, expect } from 'vitest';
import tool, { buildExport, type Note } from './online-notepad.tool';

/** A note with the given content and title. */
function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'My note',
    content: 'hello world',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('online-notepad meta', () => {
  it('is a stable text tool that renders as a panel', () => {
    expect(tool.meta.id).toBe('online-notepad');
    expect(tool.meta.category).toBe('text');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.panel).toBe('online-notepad');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('says the notes never leave the browser and how to delete them', () => {
    const faq = tool.meta.faq ?? [];
    expect(faq.length).toBeGreaterThanOrEqual(3);
    const text = faq.map((f) => `${f.q} ${f.a}`).join(' ');
    expect(text).toMatch(/never leave this browser/i);
    expect(text).toMatch(/delete all/i);
  });

  it('declares the export format and title options', () => {
    const keys = (tool.meta.options ?? []).map((o) => o.key);
    expect(keys).toContain('format');
    expect(keys).toContain('title');
    expect((tool.meta.examples ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('online-notepad export format', () => {
  it('writes a plain-text export as the raw note content', () => {
    const out = buildExport(note({ content: 'first\nsecond' }), 'txt');
    expect(out.output).toBe('first\nsecond');
    expect(out.filename).toBe('my-note.txt');
    expect(out.type).toBe('text/plain');
  });

  it('writes a Markdown export with a heading and the content', () => {
    const out = buildExport(note({ title: 'Shopping list', content: '- milk\n- eggs' }), 'md');
    expect(out.output).toBe('# Shopping list\n\n- milk\n- eggs');
    expect(out.filename).toBe('shopping-list.md');
    expect(out.type).toBe('text/markdown');
  });

  it('slugs the file name and falls back to "note"', () => {
    expect(buildExport(note({ title: 'Meeting — 24 Oct!' }), 'md').filename).toBe(
      'meeting-24-oct.md',
    );
    expect(buildExport(note({ title: '   ' }), 'txt').filename).toBe('note.txt');
  });

  it('keeps an empty note exportable rather than throwing', () => {
    const out = buildExport(note({ content: '', title: 'Empty' }), 'txt');
    expect(out.output).toBe('');
    expect(out.filename).toBe('empty.txt');
  });

  it('trims the trailing newline of a Markdown heading-only note', () => {
    expect(buildExport(note({ title: 'Notes', content: '' }), 'md').output).toBe('# Notes');
  });
});

describe('online-notepad run()', () => {
  const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
    tool.run({ text, options }) as {
      output: string;
      filename: string;
      render?: string;
      language?: string;
      stats?: Record<string, string | number>;
    };

  it('defaults to a plain-text export', () => {
    const out = run('hello');
    expect(out.output).toBe('hello');
    expect(out.filename).toBe('note.txt');
    expect(out.render).toBe('code');
    expect(out.language).toBe('text');
    expect(out.stats).toMatchObject({ format: 'txt', characters: 5 });
  });

  it('honours the format and title options', () => {
    const out = run('**bold**', { format: 'md', title: 'My Note' });
    expect(out.output).toBe('# My Note\n\n**bold**');
    expect(out.filename).toBe('my-note.md');
    expect(out.language).toBe('markdown');
  });

  it('treats an unknown format as plain text', () => {
    const out = run('x', { format: 'rtf' });
    expect(out.filename).toBe('note.txt');
    expect(out.stats).toMatchObject({ format: 'txt' });
  });

  it('exports empty input as an empty file', () => {
    const out = run('');
    expect(out.output).toBe('');
    expect(out.stats).toMatchObject({ characters: 0 });
  });
});
