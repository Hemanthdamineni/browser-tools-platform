import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './binary-file-signature.tool';

function file(bytes: number[], name = 'sample.bin'): File {
  return new File([new Uint8Array(bytes)], name);
}

async function rowsFor(...files: File[]) {
  const result = await tool.run({ files, options: {} });
  expect(result.outputs).toEqual([]);
  expect(result.report?.render).toBe('table');
  return JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
}

describe('binary-file-signature', () => {
  it('identifies common binary signatures and reports MIME and extension check', async () => {
    const report = await rowsFor(
      file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'photo.png'),
      file([0x25, 0x50, 0x44, 0x46, 0x2d], 'document.pdf'),
      file([0x50, 0x4b, 0x03, 0x04], 'package.docx'),
    );
    expect(report.headers).toEqual([
      'Filename',
      'Detected format',
      'Likely MIME',
      'Extension check',
      'File size',
      'First bytes (hex)',
      'Notes',
    ]);
    expect(report.rows.map((row) => row.slice(1, 4))).toEqual([
      ['PNG image', 'image/png', 'Matches'],
      ['PDF document', 'application/pdf', 'Matches'],
      ['ZIP archive / package', 'application/zip', 'Matches'],
    ]);
  });

  it('reports extension mismatches, extensionless files, and unknown formats', async () => {
    const report = await rowsFor(
      file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'misnamed.jpg'),
      file([0x25, 0x50, 0x44, 0x46, 0x2d], 'download'),
      file([0x01, 0x02, 0x03], 'custom.dat'),
      file([], 'empty'),
    );
    expect(report.rows.map((row) => row.slice(1, 4))).toEqual([
      ['PNG image', 'image/png', 'Differs'],
      ['PDF document', 'application/pdf', 'No extension'],
      ['Unknown', 'Unknown', 'Unverified'],
      ['Empty file', 'Unknown', 'No extension'],
    ]);
  });

  it('checks container-specific secondary markers', async () => {
    const report = await rowsFor(
      file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'image.webp'),
      file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], 'sound.wav'),
      file([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20], 'movie.mov'),
    );
    expect(report.rows.map((row) => row[1])).toEqual([
      'WebP image',
      'WAV audio',
      'QuickTime movie',
    ]);
  });

  it('recognizes signatures located at nonzero offsets', async () => {
    const tar = new Array(262).fill(0);
    tar.splice(257, 5, 0x75, 0x73, 0x74, 0x61, 0x72);
    const mp4 = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];
    const report = await rowsFor(file(tar, 'archive.tar'), file(mp4, 'clip.mp4'));
    expect(report.rows.map((row) => row[1])).toEqual(['TAR archive', 'ISO Base Media file']);
  });

  it('reads only a bounded prefix even for large files', async () => {
    const prefix = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([prefix, new Uint8Array(10 * 1024 * 1024)]);
    const large = new File([blob], 'large.png');
    const result = await tool.run({ files: [large], options: {} });
    expect(result.stats?.['bytes read per file (max)']).toBe(512);
    expect(result.stats?.identified).toBe(1);
  });

  it('warns that signatures are heuristic and not a security verdict', async () => {
    const result = await tool.run({ files: [file([0x00])], options: {} });
    expect(result.warnings?.join(' ')).toMatch(/not a security verdict/i);
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
