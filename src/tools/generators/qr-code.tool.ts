import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './qr-code.meta';
import qrcode from 'qrcode-generator';

/** Build the raw QR payload for the chosen content type. */
export function buildPayload(
  contentType: string,
  text: string,
  opts: { wifiPassword?: string; wifiEncryption?: string } = {},
): string {
  const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  switch (contentType) {
    case 'wifi': {
      const enc =
        opts.wifiEncryption === 'WEP' ? 'WEP' : opts.wifiEncryption === 'nopass' ? 'nopass' : 'WPA';
      const pw = enc === 'nopass' ? '' : `P:${escapeWifi(opts.wifiPassword ?? '')};`;
      return `WIFI:T:${enc};S:${escapeWifi(text)};${pw};`;
    }
    case 'email':
      return `mailto:${text}`;
    case 'sms':
      return `smsto:${text}`;
    case 'tel':
      return `tel:${text}`;
    case 'geo':
      return `geo:${text}`;
    default:
      return text;
  }
}

const isHex = (s: string) => /^#[0-9a-fA-F]{3,8}$/.test(s.trim());

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const contentType = String(o.contentType ?? 'text');
  const ecc = String(o.ecc ?? 'M') as 'L' | 'M' | 'Q' | 'H';
  const cellSize = Math.min(16, Math.max(2, Math.floor(Number(o.cellSize ?? 6))));
  const margin = Math.min(8, Math.max(0, Math.floor(Number(o.margin ?? 4))));
  const dark = String(o.dark ?? '#000000').trim();
  const light = String(o.light ?? '#ffffff').trim();
  for (const [name, c] of [
    ['Dark colour', dark],
    ['Light colour', light],
  ] as const) {
    if (!isHex(c))
      throw new ToolError(`"${c}" is not a hex colour.`, `Enter ${name} as #rgb or #rrggbb.`);
  }

  const payload = buildPayload(contentType, input.text, {
    wifiPassword: String(o.wifiPassword ?? ''),
    wifiEncryption: String(o.wifiEncryption ?? 'WPA'),
  });

  let qr: ReturnType<typeof qrcode>;
  try {
    qr = qrcode(0, ecc);
    qr.addData(payload);
    qr.make();
  } catch {
    throw new ToolError(
      'Too much data for one QR code.',
      'Shorten the text or lower the error-correction level.',
    );
  }

  const count = qr.getModuleCount();
  const size = (count + margin * 2) * cellSize;
  const rects: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects.push(
          `<rect x="${(c + margin) * cellSize}" y="${(r + margin) * cellSize}" width="${cellSize}" height="${cellSize}"/>`,
        );
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join('')}</g></svg>`;

  return {
    output: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
    render: 'image',
    filename: 'qr.svg',
    stats: { modules: `${count} × ${count}`, size: `${size} × ${size} px`, ecc },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
