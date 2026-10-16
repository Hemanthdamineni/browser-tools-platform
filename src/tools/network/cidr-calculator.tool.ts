import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cidr-calculator.meta';

const IPV4_BITS = 32n;
const IPV6_BITS = 128n;
const IPV4_MAX = (1n << IPV4_BITS) - 1n;

function parseIpv4(input: string): bigint {
  const parts = input.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    throw new ToolError('Enter a valid IPv4 address.', 'Use four decimal octets from 0 to 255.');
  }
  let value = 0n;
  for (const part of parts) {
    const octet = Number(part);
    if (octet > 255) throw new ToolError('IPv4 octets must be between 0 and 255.');
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

function parseIpv6(input: string): bigint {
  let address = input.toLowerCase();
  if (address.includes('%')) throw new ToolError('IPv6 zone identifiers are not accepted.', 'Remove the %zone suffix before calculating the address.');

  if (address.includes('.')) {
    const separator = address.lastIndexOf(':');
    if (separator < 0) throw new ToolError('Invalid IPv4-embedded IPv6 address.');
    const ipv4 = parseIpv4(address.slice(separator + 1));
    address = `${address.slice(0, separator)}:${((ipv4 >> 16n) & 0xffffn).toString(16)}:${(ipv4 & 0xffffn).toString(16)}`;
  }

  if (!/^[0-9a-f:]+$/.test(address) || !address.includes(':')) {
    throw new ToolError('Enter a valid IPv6 address.', 'Use hexadecimal groups separated by colons.');
  }
  const doubleColon = address.indexOf('::');
  if (doubleColon !== -1 && address.indexOf('::', doubleColon + 2) !== -1) {
    throw new ToolError('An IPv6 address may contain only one :: compression marker.');
  }

  let groups: string[];
  if (doubleColon === -1) {
    groups = address.split(':');
    if (groups.length !== 8) throw new ToolError('An uncompressed IPv6 address must contain eight groups.');
  } else {
    const left = address.slice(0, doubleColon) ? address.slice(0, doubleColon).split(':') : [];
    const right = address.slice(doubleColon + 2) ? address.slice(doubleColon + 2).split(':') : [];
    const zeros = 8 - left.length - right.length;
    if (zeros < 1) throw new ToolError('The :: marker must compress at least one IPv6 group.');
    groups = [...left, ...Array(zeros).fill('0'), ...right];
  }

  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    throw new ToolError('Invalid IPv6 group.', 'Each group must contain one to four hexadecimal digits.');
  }
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 255n)).join('.');
}

function formatIpv6(value: bigint): string {
  const groups = Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & 0xffffn));
  let bestStart = -1;
  let bestLength = 1;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== 0) { i++; continue; }
    let end = i;
    while (end < groups.length && groups[end] === 0) end++;
    if (end - i > bestLength) {
      bestStart = i;
      bestLength = end - i;
    }
    i = end;
  }
  if (bestStart < 0) return groups.map((group) => group.toString(16)).join(':');
  const left = groups.slice(0, bestStart).map((group) => group.toString(16)).join(':');
  const right = groups.slice(bestStart + bestLength).map((group) => group.toString(16)).join(':');
  return `${left}::${right}`;
}

function calculate(input: string): { rows: string[][]; version: 'IPv4' | 'IPv6'; prefix: number; count: bigint } {
  const slash = input.lastIndexOf('/');
  if (slash < 1 || slash === input.length - 1) {
    throw new ToolError('Include a CIDR prefix after /.', 'Example: 192.168.1.5/24 or 2001:db8::1/64.');
  }
  const address = input.slice(0, slash).trim();
  const prefixText = input.slice(slash + 1).trim();
  if (!/^\d+$/.test(prefixText)) throw new ToolError('CIDR prefix must be a whole number.');
  const version = address.includes(':') ? 'IPv6' : 'IPv4';
  const bits = version === 'IPv4' ? IPV4_BITS : IPV6_BITS;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || BigInt(prefix) > bits) {
    throw new ToolError(`${version} prefix must be between 0 and ${bits}.`);
  }
  const value = version === 'IPv4' ? parseIpv4(address) : parseIpv6(address);
  const hostBits = bits - BigInt(prefix);
  const blockSize = 1n << hostBits;
  const network = (value >> hostBits) << hostBits;
  const last = network + blockSize - 1n;
  const format = version === 'IPv4' ? formatIpv4 : formatIpv6;
  const rows: string[][] = [
    ['Version', version],
    ['Network', `${format(network)}/${prefix}`],
    ['First address', format(network)],
    ['Last address', format(last)],
    ['Address count', blockSize.toString()],
    ['Prefix length', `/${prefix}`],
  ];

  if (version === 'IPv4') {
    const mask = prefix === 0 ? 0n : (IPV4_MAX << (IPV4_BITS - BigInt(prefix))) & IPV4_MAX;
    const usable = prefix === 32 ? 1n : prefix >= 31 ? 0n : blockSize - 2n;
    rows.push(
      ['Netmask', formatIpv4(mask)],
      ['Wildcard mask', formatIpv4(IPV4_MAX ^ mask)],
      ['Broadcast', formatIpv4(last)],
      ['Usable hosts (conventional)', usable.toString()],
    );
    if (prefix === 31) rows.push(['Note', 'RFC 3021 point-to-point links may use both addresses.']);
    if (prefix === 32) rows.push(['Note', 'A /32 is a single address.']);
  } else {
    rows.push(['Broadcast', 'Not applicable to IPv6']);
  }
  return { rows, version, prefix, count: blockSize };
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '', render: 'table' };
  const result = calculate(text);
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows: result.rows }),
    render: 'table',
    stats: { version: result.version, prefix: `/${result.prefix}`, addresses: result.count.toString() },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
