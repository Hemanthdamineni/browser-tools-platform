#!/usr/bin/env node
/**
 * Generate tiny binary fixtures for the Batch C e2e spec (E4-S8).
 * Node-only, committed, no browser required:
 *   - e2e/fixtures/tiny.png        — 2×2 PNG (hand-built PNG with a zlib stream)
 *   - e2e/fixtures/tone.wav        — 0.1s mono 440 Hz sine WAV
 *   - e2e/fixtures/one-page.pdf    — 1-page PDF (pdf-lib not required: minimal valid PDF)
 *
 * Run: node scripts/gen-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 as zlibCrc32 } from 'node:zlib';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures');

/* ------------------------------- PNG (2×2) ------------------------------- */

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcVal = zlibCrc32(body);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcVal);
  return Buffer.concat([len, body, crc]);
}

function buildPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // scanlines: 1 filter byte + raw bytes each
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[y * (1 + w * 4) + 1 + x * 4] = rgba[i];
      raw[y * (1 + w * 4) + 1 + x * 4 + 1] = rgba[i + 1];
      raw[y * (1 + w * 4) + 1 + x * 4 + 2] = rgba[i + 2];
      raw[y * (1 + w * 4) + 1 + x * 4 + 3] = rgba[i + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = buildPng(2, 2, [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);

/* ----------------------------- WAV (0.1 s) ------------------------------ */

function buildWav(sampleRate, seconds, toneHz) {
  const n = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * toneHz * i) / sampleRate) * 32767);
    data.writeInt16LE(v, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const wav = buildWav(8000, 0.1, 440);

/* ------------------------------ 1-page PDF ------------------------------ */

// Minimal valid 1-page PDF with the text "Hello Toolbench".
function buildPdf() {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const pages = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>');
  const catalog = add('<< /Type /Catalog /Pages 3 0 R >>');
  const pageTree = add('<< /Type /Pages /Kids [1 0 R] /Count 1 >>');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const stream = 'BT /F1 12 Tf 20 100 Td (Hello Toolbench) Tj ET';
  const streamObj = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    out += `${String(offsets[i + 1]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\n`;
  out += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const pdf = buildPdf();

/* ---------------------------------- write --------------------------------- */

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'tiny.png'), png);
writeFileSync(join(outDir, 'tone.wav'), wav);
writeFileSync(join(outDir, 'one-page.pdf'), pdf);
console.log(
  `wrote ${outDir}: tiny.png (${png.length}B), tone.wav (${wav.length}B), one-page.pdf (${pdf.length}B)`,
);
