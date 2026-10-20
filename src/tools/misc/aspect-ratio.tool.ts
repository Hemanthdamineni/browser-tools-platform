import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './aspect-ratio.meta';

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

const PRESETS: Record<string, [string, number, number][]> = {
  '16:9': [
    ['HD (1280×720)', 1280, 720],
    ['Full HD (1920×1080)', 1920, 1080],
    ['QHD (2560×1440)', 2560, 1440],
    ['4K UHD (3840×2160)', 3840, 2160],
  ],
  '4:3': [
    ['VGA (640×480)', 640, 480],
    ['XGA (1024×768)', 1024, 768],
    ['UXGA (1600×1200)', 1600, 1200],
  ],
  '21:9': [
    ['Ultrawide (2560×1080)', 2560, 1080],
    ['Ultrawide QHD (3440×1440)', 3440, 1440],
  ],
  '1:1': [
    ['Square (1080×1080)', 1080, 1080],
    ['Square 4K (2160×2160)', 2160, 2160],
  ],
  '3:2': [
    ['Photo (1800×1200)', 1800, 1200],
    ['MacBook Pro 14 (3024×1964)', 3024, 1964],
  ],
  '5:4': [['SXGA (1280×1024)', 1280, 1024]],
  '9:16': [
    ['Portrait HD (1080×1920)', 1080, 1920],
    ['Portrait 4K (2160×3840)', 2160, 3840],
  ],
  '2.39:1': [['CinemaScope (2390×1000)', 2390, 1000]],
};

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const rw = Number(o.ratioW);
  const rh = Number(o.ratioH);
  if (mode !== 'presets' && (!Number.isFinite(rw) || !Number.isFinite(rh) || rw <= 0 || rh <= 0)) {
    throw new ToolError('Both ratio components must be greater than zero.');
  }
  if (mode === 'presets') {
    const rows = Object.entries(PRESETS).flatMap(([ratio, entries]) =>
      entries.map(([name, w, h]) => [name, `${w} × ${h}`, ratio]),
    );
    return {
      output: JSON.stringify({ headers: ['Preset', 'Resolution', 'Aspect ratio'], rows }),
      render: 'table',
      stats: { resolutions: rows.length },
    };
  }
  const g = gcd(rw, rh);
  const sw = rw / g;
  const sh = rh / g;
  const ratio = `${sw}:${sh}`;
  const decimal = rw / rh;
  const common: Record<string, string> = {
    '16:9': '16:9',
    '4:3': '4:3',
    '21:9': '21:9',
    '1:1': '1:1',
    '3:2': '3:2',
    '5:4': '5:4',
    '9:16': '9:16',
    '2.39:1': 'CinemaScope (2.39:1)',
  };
  const near =
    Object.entries(common).find(([key]) => {
      const [a, b] = key.split(':').map(Number);
      return Math.abs(decimal - a! / b!) < 0.015;
    })?.[1] ?? 'Custom';
  if (mode === 'simplify') {
    const rows = [
      ['Simplified ratio', ratio],
      ['Decimal', decimal.toFixed(3)],
      ['Nearest common ratio', near],
    ];
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
      render: 'table',
      stats: { ratio, decimal: decimal.toFixed(3) },
    };
  }
  const knownWidth = Number(o.knownWidth);
  const knownHeight = Number(o.knownHeight);
  if (knownWidth > 0 && knownHeight > 0)
    throw new ToolError('Enter only one known dimension, either width or height.');
  if (knownWidth > 0) {
    const h = (knownWidth * rh) / rw;
    const rows = [
      ['Aspect ratio', ratio],
      ['Width', String(knownWidth)],
      ['Height', h.toFixed(2)],
    ];
    return {
      output: JSON.stringify({ headers: ['Dimension', 'Value'], rows }),
      render: 'table',
      stats: { height: h.toFixed(2) },
    };
  }
  if (knownHeight > 0) {
    const w = (knownHeight * rw) / rh;
    const rows = [
      ['Aspect ratio', ratio],
      ['Width', w.toFixed(2)],
      ['Height', String(knownHeight)],
    ];
    return {
      output: JSON.stringify({ headers: ['Dimension', 'Value'], rows }),
      render: 'table',
      stats: { width: w.toFixed(2) },
    };
  }
  throw new ToolError('Enter a known width or height to solve for the other dimension.');
}

const tool: TextToolModule = { meta, run };
export default tool;
