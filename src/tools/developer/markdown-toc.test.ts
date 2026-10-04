import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './markdown-toc.tool';

const run = async (text: string) =>
  (await tool.run({ text, options: {} })) as {
    output: string;
    notes?: string[];
    language?: string;
    filename?: string;
    stats?: Record<string, string | number>;
  };

describe('markdown-toc', () => {
  it('generates nested links for ATX headings', async () => {
    const result = await run('# Guide\n\n## Install\n\n### Requirements\n\n## Usage');
    expect(result.output).toBe(
      '- [Guide](#guide)\n  - [Install](#install)\n    - [Requirements](#requirements)\n  - [Usage](#usage)',
    );
  });

  it('recognizes Setext headings', async () => {
    expect((await run('Title\n=====\n\nPart\n----')).output).toBe(
      '- [Title](#title)\n  - [Part](#part)',
    );
  });

  it('ignores headings inside fenced code blocks', async () => {
    expect((await run('# Real\n\n```md\n# Not a heading\n```')).output).toBe('- [Real](#real)');
  });

  it('assigns duplicate slugs with incrementing suffixes', async () => {
    expect((await run('# Overview\n\n## Overview\n\n## Overview')).output).toBe(
      '- [Overview](#overview)\n  - [Overview](#overview-1)\n  - [Overview](#overview-2)',
    );
  });

  it('removes inline Markdown syntax and retains visible heading text', async () => {
    expect((await run('# **Getting Started**\n\n## Install `tool`')).output).toBe(
      '- [Getting Started](#getting-started)\n  - [Install tool](#install-tool)',
    );
  });

  it('returns a note when there are no headings', async () => {
    const result = await run('Just a paragraph.');
    expect(result.output).toBe('');
    expect(result.notes).toEqual(['No Markdown headings were found.']);
  });

  it('returns empty output for empty input', async () => {
    expect((await run('  \n')).output).toBe('');
  });

  it('provides output metadata and heading stats', async () => {
    const result = await run('# A');
    expect(result.language).toBe('markdown');
    expect(result.filename).toBe('table-of-contents.md');
    expect(result.stats?.headings).toBe(1);
  });

  it('rejects oversized input', async () => {
    await expect(run('x'.repeat(500_001))).rejects.toBeInstanceOf(ToolError);
  });
});
