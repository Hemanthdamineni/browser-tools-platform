import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ip-address-inspector.meta';

type V4 = { version: 4; host: string; octets: number[]; port?: number };
type V6 = {
  version: 6;
  host: string;
  groups: number[];
  port?: number;
  zone?: string;
  mapped?: number[];
};
type Parsed = V4 | V6;
type Row = [string, string];

const HEX = /^[0-9A-Fa-f]{1,4}$/;

function bad(msg: string): never {
  throw new ToolError(msg);
}

function toPort(raw: string): number {
  if (!/^\d{1,5}$/.test(raw)) bad(`"${raw}" is not a valid port.`);
  const p = Number(raw);
  if (p > 65535) bad(`Port ${p} is out of range (0-65535).`);
  return p;
}

function toV4(host: string, port?: number): V4 {
  const parts = host.split('.');
  if (parts.length !== 4) bad(`"${host}" is not a valid IPv4 address.`);
  const octets = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) bad(`"${host}" is not a valid IPv4 address.`);
    const n = Number(p);
    if (n > 255) bad(`IPv4 octet ${n} is out of range (0-255).`);
    return n;
  });
  return port === undefined ? { version: 4, host, octets } : { version: 4, host, octets, port };
}

function sideGroups(parts: string[]): number[] {
  const out: number[] = [];
  for (const part of parts) {
    if (part.includes('.')) {
      const o = toV4(part).octets;
      out.push((o[0]! << 8) | o[1]!, (o[2]! << 8) | o[3]!);
    } else {
      if (!HEX.test(part)) bad(`"${part}" is not a valid IPv6 group.`);
      out.push(parseInt(part, 16));
    }
  }
  return out;
}

function toV6(host: string, port?: number, zone?: string): V6 {
  if (host.includes(':::')) bad(`"${host}" is not a valid IPv6 address.`);
  const halves = host.split('::');
  if (halves.length > 2) bad(`"${host}" is not a valid IPv6 address.`);
  const left = sideGroups(halves[0]!.split(':').filter(Boolean));
  const right = halves.length === 2 ? sideGroups(halves[1]!.split(':').filter(Boolean)) : [];
  const gap = 8 - left.length - right.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) bad(`"${host}" is not a valid IPv6 address.`);
  const groups = [...left, ...Array.from({ length: gap }, () => 0), ...right];
  const node: V6 = { version: 6, host, groups };
  if (port !== undefined) node.port = port;
  if (zone) node.zone = zone;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    node.mapped = [
      (groups[6]! >> 8) & 0xff,
      groups[6]! & 0xff,
      (groups[7]! >> 8) & 0xff,
      groups[7]! & 0xff,
    ];
  }
  return node;
}

function parse(raw: string): Parsed {
  const text = raw.trim();
  if (!text) bad('Enter an IP address.');
  let zone: string | undefined;
  let body = text;
  const pct = body.lastIndexOf('%');
  if (pct !== -1) {
    zone = body.slice(pct + 1);
    body = body.slice(0, pct);
  }
  if (body.startsWith('[')) {
    const close = body.indexOf(']');
    if (close === -1) bad('Missing "]" in the bracketed IPv6 address.');
    const inner = body.slice(1, close);
    const tail = body.slice(close + 1);
    let port: number | undefined;
    if (tail.startsWith(':')) port = toPort(tail.slice(1));
    else if (tail) bad(`Unexpected "${tail}" after the IPv6 address.`);
    return toV6(inner, port, zone);
  }
  const colons = (body.match(/:/g) ?? []).length;
  if (colons >= 2) return toV6(body, undefined, zone);
  if (colons === 1) {
    const idx = body.lastIndexOf(':');
    return toV4(body.slice(0, idx), toPort(body.slice(idx + 1)));
  }
  if (zone) bad('A zone identifier is only valid on an IPv6 address.');
  return toV4(body);
}

function expand(groups: number[]): string {
  return groups.map((g) => g.toString(16).padStart(4, '0')).join(':');
}

function compress(groups: number[]): string {
  const hex = groups.map((g) => g.toString(16));
  let start = -1;
  let len = 0;
  let rs = -1;
  let rl = 0;
  for (let i = 0; i < hex.length; i++) {
    if (hex[i] === '0') {
      if (rs === -1) {
        rs = i;
        rl = 1;
      } else rl++;
    } else {
      if (rl > len) {
        start = rs;
        len = rl;
      }
      rs = -1;
      rl = 0;
    }
  }
  if (rl > len) {
    start = rs;
    len = rl;
  }
  if (start === -1 || len < 2) return hex.join(':');
  const head = hex.slice(0, start).join(':');
  const tail = hex.slice(start + len).join(':');
  return `${head}::${tail}`;
}

function classifyV4(o: number[]): string[] {
  const [a, b, c] = o as [number, number, number, number];
  const out: string[] = [];
  if (a === 0) out.push('unspecified ("this network")');
  if (a === 10) out.push('private (RFC 1918)');
  if (a === 100 && b >= 64 && b <= 127) out.push('carrier-grade NAT (RFC 6598)');
  if (a === 127) out.push('loopback');
  if (a === 169 && b === 254) out.push('link-local (APIPA)');
  if (a === 172 && b >= 16 && b <= 31) out.push('private (RFC 1918)');
  if (a === 192 && b === 0 && c === 2) out.push('documentation TEST-NET-1');
  if (a === 192 && b === 168) out.push('private (RFC 1918)');
  if (a === 198 && b === 51 && c === 100) out.push('documentation TEST-NET-2');
  if (a === 203 && b === 0 && c === 113) out.push('documentation TEST-NET-3');
  if (a === 198 && (b === 18 || b === 19)) out.push('benchmarking (RFC 2544)');
  if (a === 192 && b === 88 && c === 99) out.push('deprecated 6to4 relay anycast');
  if (a >= 224 && a <= 239) out.push('multicast');
  if (a === 255 && b === 255 && c === 255 && o[3] === 255) out.push('limited broadcast');
  else if (a >= 240) out.push('reserved (RFC 1112)');
  if (!out.length) out.push('global unicast (public)');
  return out;
}

function classifyV6(g: number[]): string[] {
  const first = g[0]!;
  const allZero = g.every((x) => x === 0);
  const out: string[] = [];
  if (allZero) out.push('unspecified');
  else if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) out.push('loopback');
  else if ((first & 0xffc0) === 0xfe80) out.push('link-local (fe80::/10)');
  else if ((first & 0xfe00) === 0xfc00) out.push('unique local, private (fc00::/7)');
  else if ((first & 0xffc0) === 0xfec0) out.push('site-local, deprecated (fec0::/10)');
  else if ((first & 0xff00) === 0xff00) out.push('multicast (ff00::/8)');
  else if (first === 0x2001 && g[1] === 0x0db8) out.push('documentation (2001:db8::/32)');
  else if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) out.push('IPv4-mapped');
  else if (first >= 0x2000 && first <= 0x3fff) out.push('global unicast (2000::/3)');
  else out.push('reserved / special purpose');
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff && !out.includes('IPv4-mapped'))
    out.push('IPv4-mapped');
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const showBinary = Boolean(o.showBinary);
  const raw = input.text.trim();
  if (!raw) {
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }),
      render: 'table',
      notes: ['Paste an IPv4 or IPv6 address (a port or IPv6 zone is optional).'],
    };
  }
  const ip = parse(raw);
  const rows: Row[] = [];
  rows.push(['Address', raw]);
  if (ip.version === 4) {
    rows.push(['Version', 'IPv4']);
    rows.push(['Classification', classifyV4(ip.octets).join(', ')]);
    rows.push(['Decimal octets', ip.octets.join('.')]);
    if (showBinary)
      rows.push(['Binary octets', ip.octets.map((n) => n.toString(2).padStart(8, '0')).join('.')]);
    rows.push(['Hex octets', ip.octets.map((n) => n.toString(16).padStart(2, '0')).join('.')]);
    rows.push(['IPv6-mapped form', `::ffff:${ip.octets.join('.')}`]);
    if (ip.port !== undefined) rows.push(['Port', String(ip.port)]);
  } else {
    rows.push(['Version', 'IPv6']);
    rows.push(['Classification', classifyV6(ip.groups).join(', ')]);
    rows.push(['Expanded', expand(ip.groups)]);
    rows.push(['Compressed', compress(ip.groups)]);
    rows.push(['16-bit groups', ip.groups.map((g) => g.toString(16)).join(' ')]);
    if (showBinary)
      rows.push([
        'Binary (first 32 bits)',
        ip.groups
          .slice(0, 2)
          .map((g) => g.toString(2).padStart(16, '0'))
          .join(' '),
      ]);
    if (ip.mapped) rows.push(['Embedded IPv4', ip.mapped.join('.')]);
    if (ip.zone !== undefined) rows.push(['Zone', ip.zone]);
    if (ip.port !== undefined) rows.push(['Port', String(ip.port)]);
  }
  const privateV4 =
    ip.version === 4 &&
    classifyV4(ip.octets).some(
      (c) => c.includes('private') || c.includes('loopback') || c.includes('link-local'),
    );
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: {
      version: ip.version,
      ...(ip.port !== undefined ? { port: ip.port } : {}),
      scope:
        privateV4 ||
        (ip.version === 6 &&
          classifyV6(ip.groups).some((c) => c.includes('private') || c.includes('link-local')))
          ? 'non-public'
          : 'public',
    },
    notes:
      ip.version === 6 && ip.mapped
        ? ['This IPv6 address embeds an IPv4 address (::ffff:0:0/96).']
        : [
            'Classification follows the IANA special-purpose registries; no network lookups are performed.',
          ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
