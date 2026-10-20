import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './subtitle-converter.meta';

interface Cue {
  start: number;
  end: number;
  text: string;
}

const ARROW_RE =
  /^\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function toMs(h: number, m: number, s: number, milli: number): number {
  return h * 3600000 + m * 60000 + s * 1000 + milli;
}

function parseInput(text: string): Cue[] {
  const lines = text.split(/\r?\n/);
  const cues: Cue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(ARROW_RE);
    if (!m) continue;
    const start = toMs(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]!.padEnd(3, '0')));
    const end = toMs(Number(m[5]), Number(m[6]), Number(m[7]), Number(m[8]!.padEnd(3, '0')));
    const textLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!;
      if (line.trim() === '') break;
      if (ARROW_RE.test(line)) break;
      textLines.push(line.replace(/\s+$/, ''));
    }
    cues.push({ start, end, text: textLines.join('\n') });
  }
  return cues;
}

function fmtTime(ms: number, sep: ',' | '.'): string {
  const totalMs = Math.max(0, Math.round(ms));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const milli = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(milli).padStart(3, '0')}`;
}

function renderSrt(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${fmtTime(c.start, ',')} --> ${fmtTime(c.end, ',')}\n${c.text}`)
      .join('\n\n') + '\n'
  );
}

function renderVtt(cues: Cue[]): string {
  return (
    'WEBVTT\n\n' +
    cues.map((c) => `${fmtTime(c.start, '.')} --> ${fmtTime(c.end, '.')}\n${c.text}`).join('\n\n') +
    '\n'
  );
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const target = String(o.target);
  const rawShift = Number(o.shift);
  const shiftMs = Number.isFinite(rawShift) ? rawShift * 1000 : 0;

  const text = input.text ?? '';
  if (!text.trim()) {
    throw new ToolError(
      'Paste an SRT or WebVTT subtitle file to convert.',
      'Cue timestamps look like 00:00:01,500 --> 00:00:04,000.',
    );
  }

  const trimmed = text.trimStart();
  const detected = trimmed.startsWith('WEBVTT') ? 'vtt' : 'srt';
  const targetFormat = target === 'auto' ? (detected === 'srt' ? 'vtt' : 'srt') : target;

  let cues = parseInput(text);
  if (cues.length === 0) {
    throw new ToolError(
      'No subtitle cues were found.',
      'A cue needs a timestamp line like 00:00:01,500 --> 00:00:04,000.',
    );
  }

  if (shiftMs !== 0) {
    cues = cues
      .map((c) => ({ start: c.start + shiftMs, end: c.end + shiftMs, text: c.text }))
      .filter((c) => c.end > 0)
      .map((c) => ({ start: Math.max(0, c.start), end: Math.max(0, c.end), text: c.text }));
  }

  const output = targetFormat === 'srt' ? renderSrt(cues) : renderVtt(cues);
  const notes: string[] = [
    `Detected ${detected.toUpperCase()}, converted to ${targetFormat.toUpperCase()}: ${cues.length} cue${cues.length === 1 ? '' : 's'}.`,
  ];
  if (shiftMs !== 0)
    notes.push(`All cues shifted by ${shiftMs / 1000}s${shiftMs < 0 ? ' (earlier)' : ' (later)'}.`);
  if (detected === 'vtt' && targetFormat === 'vtt')
    notes.push('Input is already VTT; a copy was re-rendered.');
  if (detected === 'srt' && targetFormat === 'srt')
    notes.push('Input is already SRT; a copy was re-rendered.');

  return {
    output,
    render: 'code',
    stats: { cues: cues.length },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
