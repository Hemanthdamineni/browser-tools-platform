import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  PAYLOAD_KIND_LABELS,
  buildVCard,
  classifyPayload,
  type QrPayload,
} from '@/lib/qr-payload';
import {
  clampMaxDimension,
  isAbortError,
  scanImageBlob,
  type DecodeOptions,
  type ScanImageResult,
} from '@/lib/qr-scan';
import { meta } from './qr-scanner.meta';

/** One code found in an image, with its classified payload. */
export interface ScanDetection {
  /** Raw decoded text. */
  text: string;
  /** Which decoder produced it. */
  source: 'native' | 'jsqr';
  payload: QrPayload;
}

/** Result of scanning a single uploaded image. */
export interface FileScan {
  filename: string;
  /** Source dimensions (0 when the file could not be read). */
  width: number;
  height: number;
  /** Dimensions actually decoded (after downscaling). */
  scannedWidth: number;
  scannedHeight: number;
  detections: ScanDetection[];
  /** Set when this file could not be read at all. */
  error?: string;
}

export interface QrScanSummary {
  files: FileScan[];
  codeCount: number;
}

/**
 * The workbench renders `report`/`outputs`/`notes` as usual; `scan` carries the
 * structured detail that the tool's own island turns into action buttons
 * (open link, copy Wi-Fi password, save contact). It survives the worker
 * boundary because it is plain, cloneable data.
 */
export interface QrScanResult extends FileRunResult {
  scan: QrScanSummary;
}

const IMAGE_HINT = 'PNG, JPEG, WebP, GIF or BMP — screenshots work well.';

/** Strip the extension and make a file-name-safe stem. */
export function fileStem(name: string): string {
  const base = name.replace(/\.[^.]*$/, '') || 'scan';
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'scan'
  );
}

function indent(text: string, pad = '    '): string {
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}

/** Human-readable summary of every image that was scanned. Pure and testable. */
export function buildReport(summary: QrScanSummary): string {
  const images = summary.files.length;
  const codes = `${summary.codeCount} QR ${summary.codeCount === 1 ? 'code' : 'codes'}`;
  const header =
    images === 1
      ? summary.codeCount === 0
        ? 'No QR code found in this image.'
        : `${codes} found in this image.`
      : `${images} images scanned — ${codes} found.`;

  const blocks = summary.files.map((file) => {
    if (file.error) return `${file.filename}\n  Could not read this file: ${file.error}`;
    const dims = `${file.width} × ${file.height}`;
    const scanned =
      file.width === file.scannedWidth && file.height === file.scannedHeight
        ? `scanned at ${dims}`
        : `scanned at ${file.scannedWidth} × ${file.scannedHeight}`;
    if (!file.detections.length) {
      return `${file.filename} · ${dims} (${scanned})\n  No QR code found.`;
    }
    const lines = file.detections.map((detection, i) => {
      const heading = `${i + 1}. ${PAYLOAD_KIND_LABELS[detection.payload.kind]} · decoded with ${
        detection.source === 'native' ? 'BarcodeDetector' : 'jsQR'
      }`;
      return `  ${heading}\n${indent(describe(detection.payload), '    ')}`;
    });
    return `${file.filename} · ${dims} (${scanned}) · ${file.detections.length} ${
      file.detections.length === 1 ? 'code' : 'codes'
    }\n${lines.join('\n')}`;
  });

  return [header, ...blocks].join('\n\n');
}

/** Key facts about one payload, as report lines. */
function describe(payload: QrPayload): string {
  switch (payload.kind) {
    case 'url': {
      const lines = [payload.url];
      if (payload.assumedScheme) lines.push(`(https:// assumed — the code held "${payload.raw}")`);
      if (payload.notice) lines.push(`Note: ${payload.notice}`);
      return lines.join('\n');
    }
    case 'wifi': {
      const lines = [
        `Network:  ${payload.ssid}`,
        `Security: ${payload.security === 'nopass' ? 'Open (no password)' : payload.security || 'unspecified'}`,
        `Password: ${payload.hasPassword ? payload.password : '(none)'}`,
      ];
      if (payload.hidden) lines.push('Hidden network: yes');
      return lines.join('\n');
    }
    case 'vcard': {
      return payload.cards
        .map((card) => {
          const lines = [`Name: ${card.name || '(unnamed)'}`];
          for (const field of card.fields) {
            if (field.property === 'FN' || field.property === 'N') continue;
            lines.push(`${field.label}: ${field.value}`);
          }
          if (card.ignored.length) {
            lines.push(
              `(rebuilt as vCard 3.0 — not carried over: ${card.ignored.join(', ')})`,
            );
          }
          return lines.join('\n');
        })
        .join('\n\n');
    }
    case 'text': {
      const lines = [payload.text];
      if (payload.notice) lines.push(`Note: ${payload.notice}`);
      return lines.join('\n');
    }
  }
}

/** Decoder that produced the most codes, for the stats row. */
function decoderLabel(scans: FileScan[]): string {
  const sources = new Set(scans.flatMap((f) => f.detections.map((d) => d.source)));
  if (sources.size === 0) return '—';
  if (sources.size > 1) return 'BarcodeDetector + jsQR';
  return sources.has('native') ? 'BarcodeDetector' : 'jsQR';
}

function uniqueName(used: Set<string>, candidate: string): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  const dot = candidate.lastIndexOf('.');
  const stem = dot > 0 ? candidate.slice(0, dot) : candidate;
  const ext = dot > 0 ? candidate.slice(dot) : '';
  for (let n = 2; n < 500; n++) {
    const next = `${stem}-${n}${ext}`;
    if (!used.has(next)) {
      used.add(next);
      return next;
    }
  }
  return `${stem}-${Date.now()}${ext}`;
}

async function run(input: FileRunInput): Promise<QrScanResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) {
    throw new ToolError(
      'Choose an image with a QR code in it.',
      `Drop or pick a screenshot, then scan. ${IMAGE_HINT}`,
    );
  }

  const tryHarder = Boolean(o.tryHarder ?? true);
  const maxDimension = clampMaxDimension(Number(o.maxDimension ?? 2048));
  const textExport = Boolean(o.textExport ?? true);
  const total = input.files.length;

  const scans: FileScan[] = [];
  const outputs: OutputFile[] = [];
  const used = new Set<string>();
  let codeCount = 0;

  for (let i = 0; i < total; i++) {
    const file = input.files[i]!;
    input.signal?.throwIfAborted?.();
    const base = i / total;
    const span = 1 / total;
    input.onProgress?.(base, total > 1 ? `Image ${i + 1} of ${total}: ${file.name}` : file.name);

    const empty: FileScan = {
      filename: file.name,
      width: 0,
      height: 0,
      scannedWidth: 0,
      scannedHeight: 0,
      detections: [],
    };

    if (file.type && !file.type.startsWith('image/')) {
      const err = new ToolError(
        `"${file.name}" is not an image.`,
        `Pick an image file. ${IMAGE_HINT}`,
      );
      if (total === 1) throw err;
      scans.push({ ...empty, error: err.message });
      continue;
    }

    const onProgress: DecodeOptions['onProgress'] = (fraction, message) =>
      input.onProgress?.(
        Math.min(0.99, base + Math.max(0, Math.min(1, fraction)) * span),
        message ? `${message} — ${file.name}` : file.name,
      );

    let result: ScanImageResult;
    try {
      result = await scanImageBlob(file, {
        maxDimension,
        tryHarder,
        signal: input.signal,
        onProgress,
      });
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof ToolError) {
        if (total === 1) throw err;
        scans.push({ ...empty, error: err.message });
        continue;
      }
      throw err;
    }

    const detections: ScanDetection[] = result.codes.map((code) => ({
      text: code.text,
      source: code.source,
      payload: classifyPayload(code.text),
    }));
    codeCount += detections.length;
    scans.push({
      filename: file.name,
      width: result.width,
      height: result.height,
      scannedWidth: result.scannedWidth,
      scannedHeight: result.scannedHeight,
      detections,
    });

    const stem = fileStem(file.name);
    for (const detection of detections) {
      if (detection.payload.kind !== 'vcard') continue;
      for (const card of detection.payload.cards) {
        const filename = uniqueName(used, `${card.stem || stem}.vcf`);
        outputs.push({
          filename,
          blob: new Blob([buildVCard(card)], { type: 'text/vcard;charset=utf-8' }),
        });
      }
    }

    if (textExport && detections.length) {
      const text = detections.map((d) => d.text).join('\n\n');
      outputs.push({
        filename: uniqueName(used, `${stem}.txt`),
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
      });
    }
  }

  const readable = scans.filter((s) => !s.error);
  if (!readable.length) {
    throw new ToolError(
      scans[0]?.error ?? 'None of those images could be read.',
      total > 1 ? 'None of the selected images could be scanned.' : IMAGE_HINT,
    );
  }

  const notes: string[] = [];
  if (codeCount > 0) {
    notes.push('Nothing opens or sends by itself — use the buttons under Detected content.');
  } else {
    notes.push(
      'Try a tighter crop around the code, a sharper photo, or raise "Max scan size" so small codes are not downscaled away.',
    );
  }
  if (codeCount > 0 && decoderLabel(readable) === 'jsQR') {
    notes.push(
      'Decoded with the bundled jsQR fallback: this browser has no native BarcodeDetector, which can read several codes in one image.',
    );
  }

  input.onProgress?.(1, 'Done');

  const summary: QrScanSummary = { files: scans, codeCount };
  return {
    outputs,
    report: { output: buildReport(summary), render: 'code', language: 'text' },
    notes,
    warnings: scans.filter((s) => s.error).map((s) => `${s.filename}: ${s.error}`),
    stats: {
      images: readable.length,
      codes: codeCount,
      decoder: decoderLabel(readable),
    },
    scan: summary,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
