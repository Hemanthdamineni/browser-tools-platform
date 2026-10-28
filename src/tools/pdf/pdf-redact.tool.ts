import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pdf-redact.meta';
import { applyRedactions } from './pdf-redact.core';
import type { RedactionBox } from './pdf-redact.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose a PDF file.');

  const file = files[0]!;
  onProgress?.(0.1, 'Reading PDF');

  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  signal?.throwIfAborted?.();

  // Get redaction coordinates from options (sent by panel as JSON string)
  const redactionsJson = String(o.redactions ?? '[]');
  let redactions: RedactionBox[];
  try {
    redactions = JSON.parse(redactionsJson);
  } catch {
    throw new ToolError('Invalid redaction coordinates');
  }

  if (redactions.length === 0) {
    throw new ToolError('No redactions to apply. Draw redaction boxes in the panel first.');
  }

  onProgress?.(0.2, 'Applying redactions...');

  const options = {
    redactionColor: String(o.redactionColor ?? 'black') as 'black' | 'white' | 'red',
    dpi: Number(o.dpi ?? 150),
  };

  const resultBytes = await applyRedactions(pdfBytes, redactions, options);
  signal?.throwIfAborted?.();

  onProgress?.(0.9, 'Finalizing...');

  const outputs: FileRunResult['outputs'] = [];
  const stem = file.name.replace(/\.pdf$/i, '');

  outputs.push({
    filename: `${stem}-redacted.pdf`,
    blob: new Blob([resultBytes], { type: 'application/pdf' }),
  });

  onProgress?.(1, 'Done');

  return {
    outputs,
    notes: [`Redacted ${redactions.length} region(s) across PDF pages`],
    stats: { redactionsApplied: redactions.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;