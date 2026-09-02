/**
 * Generate PNG app icons with zero dependencies (Node's zlib only).
 * Run: `node scripts/gen-icons.mjs`
 *
 * Draws the Toolbench mark — a rounded square with a bold "T" — at the sizes a
 * PWA + Apple/Android need. Deterministic output; commit the results.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// palette
const BG = [5, 150, 105, 255]; // brand-600
const FG = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(size, { padding = 0, radiusRatio = 0.22 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    const i = (y * size + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  const inset = Math.round(size * padding);
  const box = size - inset * 2;
  const radius = box * radiusRatio;

  const inRoundedRect = (x, y) => {
    const lx = x - inset;
    const ly = y - inset;
    if (lx < 0 || ly < 0 || lx >= box || ly >= box) return false;
    const cx = Math.min(Math.max(lx, radius), box - radius);
    const cy = Math.min(Math.max(ly, radius), box - radius);
    return Math.hypot(lx - cx, ly - cy) <= radius;
  };

  // "T" geometry, relative to the box
  const barTop = inset + box * 0.26;
  const barBottom = inset + box * 0.4;
  const barLeft = inset + box * 0.2;
  const barRight = inset + box * 0.8;
  const stemLeft = inset + box * 0.43;
  const stemRight = inset + box * 0.57;
  const stemBottom = inset + box * 0.78;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) {
        set(x, y, TRANSPARENT);
        continue;
      }
      const inBar = x >= barLeft && x <= barRight && y >= barTop && y <= barBottom;
      const inStem = x >= stemLeft && x <= stemRight && y >= barTop && y <= stemBottom;
      set(x, y, inBar || inStem ? FG : BG);
    }
  }
  return encodePng(size, size, buf);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { padding: 0.1 }],
  ['apple-touch-icon.png', 180, { radiusRatio: 0 }],
  ['favicon-48.png', 48, {}],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), draw(size, opts));
  console.log('wrote', name, `${size}x${size}`);
}

// favicon.ico — a single 48×48 PNG-encoded entry (supported by all current browsers)
function ico(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}
const fav48 = draw(48, {});
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
writeFileSync(join(PUBLIC, 'favicon.ico'), ico(fav48, 48));
console.log('wrote favicon.ico 48x48');

// og.png — 1200×630 social card: brand field, big rounded-square "T", accent bar.
function drawOg() {
  const W = 1200;
  const H = 630;
  const buf = Buffer.alloc(W * H * 4);
  const put = (x, y, [r, g, b, a]) => {
    const i = (y * W + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  const DARK = [4, 120, 87, 255]; // brand-700
  const badge = 300;
  const bx = 120;
  const by = (H - badge) / 2;
  const rad = badge * 0.22;

  const inBadge = (x, y) => {
    const lx = x - bx;
    const ly = y - by;
    if (lx < 0 || ly < 0 || lx >= badge || ly >= badge) return false;
    const cx = Math.min(Math.max(lx, rad), badge - rad);
    const cy = Math.min(Math.max(ly, rad), badge - rad);
    return Math.hypot(lx - cx, ly - cy) <= rad;
  };
  const barTop = by + badge * 0.26;
  const barBottom = by + badge * 0.4;
  const barL = bx + badge * 0.2;
  const barR = bx + badge * 0.8;
  const stemL = bx + badge * 0.43;
  const stemR = bx + badge * 0.57;
  const stemB = by + badge * 0.78;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = BG;
      if (y > H - 12) c = DARK;
      if (inBadge(x, y)) {
        const inBar = x >= barL && x <= barR && y >= barTop && y <= barBottom;
        const inStem = x >= stemL && x <= stemR && y >= barTop && y <= stemB;
        c = inBar || inStem ? FG : DARK;
      }
      put(x, y, c);
    }
  }
  return encodePng(W, H, buf);
}
writeFileSync(join(PUBLIC, 'og.png'), drawOg());
console.log('wrote og.png 1200x630');
