import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './strftime.meta';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WDA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MOA = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');
const p3 = (n: number) => String(n).padStart(3, '0');

function weeks(y: number, m: number, d: number, utc: boolean, dowOfJan1: number): { U: number; W: number } {
  const start = utc ? Date.UTC(y, 0, 1) : new Date(y, 0, 1).getTime();
  const thisDay = utc ? Date.UTC(y, m - 1, d) : new Date(y, m - 1, d).getTime();
  const doy = Math.floor((thisDay - start) / 86400000) + 1;
  const U = Math.floor((doy - 1 + dowOfJan1) / 7);
  const W = Math.floor((doy - 1 + ((dowOfJan1 + 6) % 7)) / 7);
  return { U, W };
}

function dow(y: number, m: number, d: number, utc: boolean): number {
  return utc ? new Date(Date.UTC(y, m - 1, d)).getUTCDay() : new Date(y, m - 1, d).getDay();
}

function format(formatStr: string, date: Date, utc: boolean): { value: string; unknown: string[] } {
  const y = utc ? date.getUTCFullYear() : date.getFullYear();
  const mo = utc ? date.getUTCMonth() : date.getMonth();
  const da = utc ? date.getUTCDate() : date.getDate();
  const wd = utc ? date.getUTCDay() : date.getDay();
  const h = utc ? date.getUTCHours() : date.getHours();
  const mi = utc ? date.getUTCMinutes() : date.getMinutes();
  const s = utc ? date.getUTCSeconds() : date.getSeconds();
  const ep = Math.floor(date.getTime() / 1000);
  const doy = Math.floor((date.getTime() - (utc ? Date.UTC(y, 0, 1) : new Date(y, 0, 1).getTime())) / 86400000) + 1;
  const wn = weeks(y, mo + 1, da, utc, dow(y, 1, 1, utc));
  const zi = utc ? 0 : -date.getTimezoneOffset();
  const zs = (zi < 0 ? '-' : '+') + p2(Math.floor(Math.abs(zi) / 60)) + p2(Math.abs(zi) % 60);
  const zname = utc ? 'UTC' : 'LOCAL';

  const tokens: Record<string, string> = {
    Y: p2_4(y),
    y: String(y % 100).padStart(2, '0'),
    m: p2(mo + 1),
    d: p2(da),
    e: String(da).padStart(2, ' '),
    j: p3(doy),
    H: p2(h),
    I: p2(((h + 11) % 12) + 1),
    M: p2(mi),
    S: p2(s),
    p: h < 12 ? 'AM' : 'PM',
    P: h < 12 ? 'am' : 'pm',
    w: String(wd),
    u: String(wd === 0 ? 7 : wd),
    a: WDA[wd]!,
    A: WD[wd]!,
    b: MOA[mo]!,
    h: MOA[mo]!.toLowerCase(),
    B: MO[mo]!,
    s: String(ep),
    z: zs,
    Z: zname,
    U: String(wn.U),
    W: String(wn.W),
    c: `${WDA[wd]!} ${MOA[mo]!} ${p2(da)} ${p2(h)}:${p2(mi)}:${p2(s)} ${y}`,
    D: `${p2(mo + 1)}/${p2(da)}/${String(y % 100).padStart(2, '0')}`,
    F: `${y}-${p2(mo + 1)}-${p2(da)}`,
    R: `${p2(h)}:${p2(mi)}`,
    T: `${p2(h)}:${p2(mi)}:${p2(s)}`,
    x: `${p2(mo + 1)}/${p2(da)}/${String(y % 100).padStart(2, '0')}`,
    X: `${p2(h)}:${p2(mi)}:${p2(s)}`,
    '%': '%',
  };

  let value = '';
  const unknown: string[] = [];
  const known = new Set(Object.keys(tokens));
  for (let i = 0; i < formatStr.length; i++) {
    const ch = formatStr[i]!;
    if (ch === '%') {
      const next = formatStr[i + 1] ?? '';
      if (next === '') {
        value += '%';
        break;
      }
      if (known.has(next)) {
        value += tokens[next]!;
        i += 1;
        continue;
      }
      unknown.push('%' + next);
      value += '%' + next;
      i += 1;
      continue;
    }
    value += ch;
  }
  return { value, unknown };
}

function p2_4(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).padStart(4, '0');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const formatStr = String(input.text ?? '');
  if (!formatStr.trim()) throw new ToolError('Paste a strftime format string, e.g. %Y-%m-%d.');
  const at = Number(o.at ?? 0);
  const utc = o.utc === true;
  const date = at >= 0 ? new Date(at * 1000) : new Date();
  const { value, unknown } = format(formatStr, date, utc);

  return {
    output: value + '\n',
    render: 'text',
    language: 'text',
    stats: { length: value.length },
    notes: unknown.length
      ? ['Unknown token(s) kept as-is: ' + unknown.join(', ') + '.']
      : [],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
