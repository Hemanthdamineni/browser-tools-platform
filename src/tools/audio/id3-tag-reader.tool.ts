import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './id3-tag-reader.meta';

const MAX_TAG_BYTES = 16 * 1024 * 1024;
const LATIN1 = new TextDecoder('iso-8859-1');

interface Frame {
  id: string;
  size: number;
  data: Uint8Array;
  legacy: boolean;
}

interface Picture {
  mime: string;
  kind: number;
  description: string;
  bytes: Uint8Array;
}

/** ID3v2 frame identifiers to the label shown to the user. */
const FRAME_FIELDS: Record<string, string> = {
  TIT2: 'Title',
  TT2: 'Title',
  TPE1: 'Artist',
  TP1: 'Artist',
  TALB: 'Album',
  TAL: 'Album',
  TPE2: 'Album artist',
  TP2: 'Album artist',
  TCOM: 'Composer',
  TCM: 'Composer',
  TDRC: 'Date',
  TYER: 'Year',
  TYE: 'Year',
  TRCK: 'Track',
  TRK: 'Track',
  TCON: 'Genre',
  TCO: 'Genre',
  COMM: 'Comment',
  COM: 'Comment',
  APIC: 'Artwork',
  PIC: 'Artwork',
};

function syncsafe(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) & 0x7f) << 21) |
    (((bytes[offset + 1] ?? 0) & 0x7f) << 14) |
    (((bytes[offset + 2] ?? 0) & 0x7f) << 7) |
    ((bytes[offset + 3] ?? 0) & 0x7f)
  );
}

function be32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Text frames start with an encoding byte; each encoding needs its own decoder. */
function decodeText(data: Uint8Array): string {
  if (data.length === 0) return '';
  const encoding = data[0] ?? 0;
  const rest = data.subarray(1);
  let decoder: TextDecoder;
  let bytes = rest;

  switch (encoding) {
    case 0:
      decoder = LATIN1;
      break;
    case 1:
      if (rest.length >= 2 && rest[0] === 0xff && rest[1] === 0xfe) {
        decoder = new TextDecoder('utf-16le');
        bytes = rest.subarray(2);
      } else if (rest.length >= 2 && rest[0] === 0xfe && rest[1] === 0xff) {
        decoder = new TextDecoder('utf-16be');
        bytes = rest.subarray(2);
      } else {
        decoder = new TextDecoder('utf-16le');
      }
      break;
    case 2:
      decoder = new TextDecoder('utf-16be');
      break;
    case 3:
      decoder = new TextDecoder('utf-8');
      break;
    default:
      decoder = LATIN1;
      break;
  }
  return decoder.decode(bytes).replace(/\0+$/u, '');
}

function terminatorAt(data: Uint8Array, from: number, wide: boolean): number {
  if (wide) {
    for (let i = from; i + 1 < data.length; i += 2) {
      if (data[i] === 0 && data[i + 1] === 0) return i;
    }
    return -1;
  }
  return data.indexOf(0, from);
}

function parseComment(data: Uint8Array): string {
  if (data.length < 4) return '';
  const encoding = data[0] ?? 0;
  const wide = encoding === 1 || encoding === 2;
  const rest = data.subarray(4);
  const stop = terminatorAt(rest, 0, wide);
  const start = stop === -1 ? 0 : stop + (wide ? 2 : 1);
  return decodeText(concat([Uint8Array.of(encoding), rest.subarray(start)]));
}

function parsePicture(data: Uint8Array, legacy: boolean): Picture | null {
  if (data.length < 4) return null;
  const encoding = data[0] ?? 0;
  let offset = 1;

  let mime: string;
  if (legacy) {
    mime = LATIN1.decode(data.subarray(offset, offset + 3))
      .trim()
      .toLowerCase();
    mime = mime === 'png' ? 'image/png' : 'image/jpeg';
    offset += 3;
  } else {
    const stop = data.indexOf(0, offset);
    if (stop === -1) return null;
    mime = LATIN1.decode(data.subarray(offset, stop));
    offset = stop + 1;
  }

  const kind = data[offset] ?? 0;
  offset += 1;

  const wide = encoding === 1 || encoding === 2;
  const descStop = terminatorAt(data, offset, wide);
  const description =
    descStop === -1
      ? ''
      : decodeText(concat([Uint8Array.of(encoding), data.subarray(offset, descStop)]));
  const start = descStop === -1 ? offset : descStop + (wide ? 2 : 1);

  return { mime, kind, description, bytes: data.subarray(start) };
}

function parseFrames(body: Uint8Array, version: number): Frame[] {
  const frames: Frame[] = [];
  const idLength = version === 2 ? 3 : 4;
  const headerLength = version === 2 ? 6 : 10;
  let offset = 0;

  while (offset + headerLength <= body.length) {
    if ((body[offset] ?? 0) === 0) break;
    const id = LATIN1.decode(body.subarray(offset, offset + idLength)).replace(/\0+$/u, '');
    if (!/^[A-Z0-9]{3,4}$/u.test(id)) break;

    let size: number;
    if (version === 2) {
      size =
        ((body[offset + 3] ?? 0) << 16) | ((body[offset + 4] ?? 0) << 8) | (body[offset + 5] ?? 0);
    } else if (version === 4) {
      size = syncsafe(body, offset + 4);
    } else {
      size = be32(body, offset + 4);
    }

    if (size <= 0 || offset + headerLength + size > body.length) break;
    frames.push({
      id,
      size,
      data: body.subarray(offset + headerLength, offset + headerLength + size),
      legacy: version === 2,
    });
    offset += headerLength + size;
  }
  return frames;
}

/** Undo ID3 unsynchronisation: a 0xFF byte is stored as 0xFF 0x00. */
function deunsynchronise(body: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(body.length);
  let written = 0;
  for (let i = 0; i < body.length; i += 1) {
    const byte = body[i] ?? 0;
    out[written] = byte;
    written += 1;
    if (byte === 0xff && body[i + 1] === 0x00) i += 1;
  }
  return out.slice(0, written);
}

interface V1 {
  title: string;
  artist: string;
  album: string;
  year: string;
  comment: string;
  track: string;
  genre: string;
}

function parseV1(tail: Uint8Array): V1 | null {
  if (tail.length < 128) return null;
  const base = tail.length - 128;
  const magic = LATIN1.decode(tail.subarray(base, base + 3));
  if (magic !== 'TAG') return null;

  const read = (start: number, length: number): string =>
    LATIN1.decode(tail.subarray(base + start, base + start + length))
      .replace(/\0[\s\S]*$/u, '')
      .trim();

  // ID3v1.1 stores the track number in the last comment byte.
  const hasTrack = (tail[base + 125] ?? 0) === 0 && (tail[base + 126] ?? 0) !== 0;
  return {
    title: read(3, 30),
    artist: read(33, 30),
    album: read(63, 30),
    year: read(93, 4),
    comment: read(97, hasTrack ? 28 : 30),
    track: hasTrack ? String(tail[base + 126] ?? 0) : '',
    genre: String(tail[base + 127] ?? 255),
  };
}

function extensionFor(mime: string): string {
  if (/png/iu.test(mime)) return 'png';
  if (/gif/iu.test(mime)) return 'gif';
  if (/webp/iu.test(mime)) return 'webp';
  if (/bmp/iu.test(mime)) return 'bmp';
  if (/jpe?g/iu.test(mime)) return 'jpg';
  return 'bin';
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const raw = Boolean(o.raw);
  const extractArtwork = Boolean(o.extractArtwork);

  const file = input.files[0];
  if (file === undefined) {
    throw new ToolError('Choose an MP3 file.', 'Tags are read from the file, so one is required.');
  }
  if (file.size === 0) throw new ToolError('That file is empty.');

  const notes: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, string | number> = {};
  const fields: string[][] = [];
  const outputs: FileRunResult['outputs'] = [];

  let version = 0;
  let frames: Frame[] = [];
  let tagSize = 0;
  let picture: Picture | null = null;
  let hasV2 = false;

  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (header.length === 10 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
    hasV2 = true;
    version = header[3] ?? 0;
    const revision = header[4] ?? 0;
    const flags = header[5] ?? 0;
    tagSize = syncsafe(header, 6);

    if (tagSize > MAX_TAG_BYTES) {
      throw new ToolError(
        'This ID3 tag is unusually large.',
        'Tags over 16 MB are not read, to keep the tool responsive.',
      );
    }

    const available = Math.min(tagSize, Math.max(0, file.size - 10));
    const body = new Uint8Array(await file.slice(10, 10 + available).arrayBuffer());
    if (available < tagSize) {
      warnings.push('The tag is larger than the file, so it was read truncated.');
    }

    let payload = body;
    if ((flags & 0x80) !== 0) {
      payload = deunsynchronise(payload);
      notes.push('The tag uses unsynchronisation, which was reversed before reading.');
    }

    if ((flags & 0x40) !== 0 && payload.length >= 4) {
      const declared = version === 4 ? syncsafe(payload, 0) : be32(payload, 0);
      const skip =
        version === 4
          ? Math.max(declared, 6)
          : Math.min(Math.max(declared + 4, 10), payload.length);
      payload = payload.subarray(Math.min(skip, payload.length));
      notes.push('An extended header was present and skipped.');
    }

    frames = parseFrames(payload, version);
    fields.push(['Tag version', 'ID3v2.' + version + '.' + revision]);
    fields.push(['Tag size', tagSize.toLocaleString('en-US') + ' bytes']);
    fields.push(['Frames', String(frames.length)]);
    stats.version = 'ID3v2.' + version + '.' + revision;
    stats.frames = frames.length;
  }

  const tagValues: string[][] = [];
  for (const frame of frames) {
    const label = FRAME_FIELDS[frame.id];
    if (label === undefined) continue;
    if (label === 'Artwork') {
      const parsed = parsePicture(frame.data, frame.legacy);
      if (parsed !== null) {
        picture = parsed;
        tagValues.push([
          'Artwork',
          parsed.mime + ', ' + parsed.bytes.length.toLocaleString('en-US') + ' bytes',
        ]);
        stats.artwork = parsed.mime;
      }
      continue;
    }
    const value =
      frame.id.startsWith('T') && !frame.id.startsWith('TXXX')
        ? decodeText(frame.data)
        : frame.id === 'COMM' || frame.id === 'COM'
          ? parseComment(frame.data)
          : '';
    if (value !== '') tagValues.push([label, value]);
  }

  if (hasV2 && tagValues.length === 0 && frames.length === 0) {
    warnings.push('The ID3v2 tag contains no frames.');
  }

  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 128)).arrayBuffer());
  const v1 = parseV1(tail);

  if (!hasV2 && v1 === null) {
    throw new ToolError(
      'No ID3 tag found in this file.',
      'This file has neither an ID3v2 header nor an ID3v1 trailer, so it holds no tags to read.',
    );
  }

  const labelFor: Record<string, string> = {
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    year: 'Year',
    track: 'Track',
    comment: 'Comment',
  };
  const v2Labels = new Set(tagValues.map((row) => row[0]));

  // ID3v1 only fills gaps left by ID3v2.
  const v1Values: string[][] = [];
  if (v1 !== null) {
    for (const key of ['title', 'artist', 'album', 'year', 'track', 'comment'] as const) {
      const value = v1[key];
      const label = labelFor[key] ?? key;
      if (value !== '' && !v2Labels.has(label)) {
        v1Values.push([label, value]);
        v2Labels.add(label);
      }
    }
    if (v1.genre !== '' && v1.genre !== '255' && !v2Labels.has('Genre')) {
      v1Values.push(['Genre', 'index ' + v1.genre]);
    }
    fields.push(['ID3v1 trailer', 'present']);
    stats.id3v1 = 'present';
  } else {
    stats.id3v1 = 'absent';
  }

  for (const row of tagValues) {
    if (row[0] !== undefined && row[1] !== undefined) stats[row[0]] = row[1];
  }

  const merged = [...fields, ...tagValues, ...v1Values];
  if (picture !== null && !extractArtwork) {
    notes.push('Enable "Extract cover art as a file" to download the embedded picture.');
  }

  if (extractArtwork) {
    if (picture === null) {
      warnings.push('No embedded artwork was found to extract.');
    } else {
      const image = new Uint8Array(picture.bytes.length);
      image.set(picture.bytes);
      const extension = extensionFor(picture.mime);
      outputs.push({
        filename: 'cover.' + extension,
        blob: new Blob([image], { type: picture.mime }),
      });
      notes.push('Extracted the embedded picture as cover.' + extension + '.');
    }
  }

  if (raw) {
    const rows = frames.map((frame) => {
      let preview = '';
      if (frame.id === 'APIC' || frame.id === 'PIC') {
        const parsed = parsePicture(frame.data, frame.legacy);
        preview =
          parsed === null
            ? '(unreadable picture)'
            : parsed.mime + ', ' + parsed.bytes.length + ' bytes';
      } else if (frame.id === 'COMM' || frame.id === 'COM') {
        preview = parseComment(frame.data);
      } else if (frame.id.startsWith('T')) {
        preview = decodeText(frame.data);
      }
      return [frame.id, String(frame.size), preview];
    });
    notes.push('Listing every ID3v2 frame; recognised fields also appear above.');
    return {
      outputs,
      report: {
        output: JSON.stringify({ headers: ['Frame', 'Size', 'Value'], rows }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  return {
    outputs,
    report: {
      output: JSON.stringify({ headers: ['Field', 'Value'], rows: merged }),
      render: 'table',
    },
    notes,
    warnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
