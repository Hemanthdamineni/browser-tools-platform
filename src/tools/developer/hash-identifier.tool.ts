import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './hash-identifier.meta';

type Confidence = 'High' | 'Medium' | 'Low';

interface Candidate {
  type: string;
  confidence: Confidence;
  note: string;
}

const RANK: Record<Confidence, number> = { High: 0, Medium: 1, Low: 2 };

const HEX_BY_LENGTH: Record<number, Candidate[]> = {
  8: [
    {
      type: 'CRC32',
      confidence: 'High',
      note: '8 hex chars — a 32-bit checksum, not a cryptographic hash.',
    },
    { type: 'Adler-32', confidence: 'Low', note: 'Also an 8-hex-char 32-bit checksum.' },
  ],
  32: [
    {
      type: 'MD5',
      confidence: 'High',
      note: '32 hex chars — by far the most common digest of this length.',
    },
    {
      type: 'NTLM',
      confidence: 'Medium',
      note: 'Windows password hash (MD4 of UTF-16LE); also 32 hex chars.',
    },
    { type: 'MD4', confidence: 'Low', note: '32 hex chars; rarely seen on its own.' },
  ],
  40: [
    { type: 'SHA-1', confidence: 'High', note: '40 hex chars.' },
    { type: 'RIPEMD-160', confidence: 'Low', note: 'Also produces a 40-hex-char digest.' },
  ],
  56: [
    { type: 'SHA-224', confidence: 'High', note: '56 hex chars.' },
    { type: 'SHA3-224', confidence: 'Low', note: 'Also a 56-hex-char digest.' },
  ],
  64: [
    { type: 'SHA-256', confidence: 'High', note: '64 hex chars.' },
    { type: 'SHA3-256', confidence: 'Low', note: 'Also a 64-hex-char digest.' },
    { type: 'BLAKE2s-256', confidence: 'Low', note: 'Also a 64-hex-char digest.' },
  ],
  96: [
    { type: 'SHA-384', confidence: 'High', note: '96 hex chars.' },
    { type: 'SHA3-384', confidence: 'Low', note: 'Also a 96-hex-char digest.' },
  ],
  128: [
    { type: 'SHA-512', confidence: 'High', note: '128 hex chars.' },
    { type: 'SHA3-512', confidence: 'Low', note: 'Also a 128-hex-char digest.' },
    { type: 'Whirlpool', confidence: 'Low', note: 'Also a 128-hex-char digest.' },
  ],
};

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  const raw = input.text.trim();
  if (!raw) return { output: '' };
  if (/\s/.test(raw)) {
    throw new ToolError(
      'A hash is a single token with no spaces.',
      'Remove spaces, tabs and line breaks, and identify one hash at a time.',
    );
  }

  const isHex = /^[0-9a-fA-F]+$/.test(raw);
  const isBase64 = raw.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(raw);

  const found: Candidate[] = [];

  const bcrypt = /^\$2([aby])\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(raw);
  if (bcrypt) {
    found.push({
      type: 'bcrypt',
      confidence: 'High',
      note: `Modular crypt $2${bcrypt[1]}$ with cost factor ${bcrypt[2]}.`,
    });
  } else if (/^\$2[aby]?\$/.test(raw)) {
    found.push({
      type: 'bcrypt',
      confidence: 'Medium',
      note: 'Begins with $2a/$2b/$2y$ but the length or alphabet is off.',
    });
  }

  const argon = /^\$(argon2(?:id|i|d))\$/.exec(raw);
  if (argon) {
    found.push({
      type: `Argon2 (${argon[1]!.slice(6)})`,
      confidence: 'High',
      note: 'PHC string: $argon2…$v=…$m=…,t=…,p=…$salt$hash.',
    });
  }

  if (/^\$1\$/.test(raw)) {
    found.push({
      type: 'MD5-crypt',
      confidence: 'High',
      note: 'Unix crypt(3) MD5 scheme ($1$salt$hash).',
    });
  }
  if (/^\$5\$/.test(raw)) {
    found.push({
      type: 'SHA-256-crypt',
      confidence: 'High',
      note: 'Unix crypt(3) SHA-256 scheme ($5$…$…).',
    });
  }
  if (/^\$6\$/.test(raw)) {
    found.push({
      type: 'SHA-512-crypt',
      confidence: 'High',
      note: 'Unix crypt(3) SHA-512 scheme ($6$salt$hash).',
    });
  }

  if (/^\*[0-9A-Fa-f]{40}$/.test(raw)) {
    found.push({
      type: 'MySQL 4.1+ (mysql5)',
      confidence: 'High',
      note: 'Leading * then 40 hex — SHA1(SHA1(password)).',
    });
  }

  if (/^(?:sha1|sha256|sha512):\d+:[^:]+:.+$/i.test(raw) || /^pbkdf2_sha\d+\$\d+\$/i.test(raw)) {
    found.push({
      type: 'PBKDF2',
      confidence: 'High',
      note: 'algo:iterations:salt:hash (or Django pbkdf2_sha256$iterations$salt$hash).',
    });
  }

  if (isHex) {
    const byLen = HEX_BY_LENGTH[raw.length];
    if (byLen) found.push(...byLen);
  }

  if (isBase64 && raw.length >= 4) {
    found.push({
      type: 'base64',
      confidence: 'Low',
      note: 'Length is a multiple of 4 and the alphabet fits base64 — may be encoded data, not a hash.',
    });
  }

  found.sort((a, b) => RANK[a.confidence] - RANK[b.confidence]);

  const rows: string[][] = found.map((c) => [c.type, c.confidence, c.note]);
  if (rows.length === 0) {
    rows.push([
      'Unknown',
      '—',
      `No known hash format matches a ${raw.length}-character string with this character set.`,
    ]);
  }

  return {
    output: JSON.stringify({ headers: ['Possible type', 'Confidence', 'Note'], rows }),
    render: 'table',
    stats: {
      length: raw.length,
      'character set': isHex ? 'hexadecimal' : isBase64 ? 'base64' : 'mixed / other',
      matches: found.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
