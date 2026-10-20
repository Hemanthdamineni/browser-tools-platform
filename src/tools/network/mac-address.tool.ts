import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mac-address.meta';

const VENDORS: Record<string, string> = {
  '0015E9': 'Cisco',
  '00000C': 'Cisco',
  '000F34': 'Cisco',
  '0050F2': 'Apple',
  '0017F2': 'Apple',
  A4B199: 'Apple',
  '70E32C': 'Apple',
  '3C22FB': 'Apple',
  '8841FC': 'Apple',
  F4F15A: 'Apple',
  '8C85A7': 'Apple',
  D0711A: 'Dell',
  '001B21': 'Dell',
  F8BC12: 'Dell',
  B08E1A: 'Dell',
  '1047F5': 'Hewlett Packard',
  '001D7D': 'Hewlett Packard',
  '54E6FC': 'Acer',
  BCC168: 'Acer',
  '001EC9': 'Acer',
  '3C5A37': 'ASUSTek',
  '001438': 'ASUSTek',
  '147DC5': 'ASUSTek',
  '5045D0': 'Intel',
  '005072': 'Intel',
  '001C0F': 'Intel',
  '00904C': 'Samsung',
  '8C7712': 'Samsung',
  '0050B7': 'Samsung',
  F07D68: 'Samsung',
  '00E04C': 'Samsung',
  '8063DF': 'Samsung',
  AAB4FA: 'Raspberry Pi',
  DC84E9: 'Raspberry Pi',
  B827EB: 'Raspberry Pi',
  E45F01: 'Raspberry Pi',
  ACF7F3: 'MediaTek',
  E48899: 'MediaTek',
  B04025: 'MediaTek',
  F4A52B: 'Espressif',
  '303AE4': 'Espressif',
  ECFAAB: 'Espressif',
  '001348': 'Google',
  '6014B3': 'Google',
  A4C138: 'Google',
  F8FFC2: 'Google',
  F4F5D8: 'Amazon',
  A0C2DE: 'Amazon',
  '8C48B0': 'Amazon',
  '001FA1': 'Huawei',
  '0471E8': 'Huawei',
  D03254: 'Huawei',
  C001C0: 'Huawei',
  '1C456D': 'Huawei',
  '5894CF': 'Huawei',
  '84A6C8': 'TP-LINK',
  '50C7BF': 'TP-LINK',
  C8BE19: 'TP-LINK',
  FC750B: 'TP-LINK',
  '50C58D': 'TP-LINK',
  '0CB94B': 'TP-LINK',
  A0F4F4: 'TP-LINK',
  '00056B': 'Netgear',
  '208C8D': 'Netgear',
  F4FF2C: 'Netgear',
  '5CF370': 'Netgear',
  '0090A9': 'Xircom',
  '001122': 'Test',
  '000B46': 'Test',
};

function strip(raw: string): string | null {
  const original = raw.trim().toUpperCase().replace(/\s+/g, '');
  const hex = original.replace(/[-:.]/g, '');
  if (!/^[0-9A-F]+$/.test(hex) || hex.length !== 12) return null;
  return hex;
}

function detectFormat(raw: string): string {
  const body = raw.trim().replace(/\s+/g, '');
  if (/[.]/.test(body)) return 'cisco-dot';
  if (/[-]/.test(body)) return 'dash';
  if (/:/.test(body)) return 'colon';
  return 'contiguous-hex';
}

function parseMac(raw: string): { octets: number[]; hex: string; error: string } {
  const hex = strip(raw);
  if (!hex)
    return {
      octets: [],
      hex: '',
      error: 'MAC must be 6 bytes (12 hex digits) using :, -, . or no separator.',
    };
  const octets = hex.match(/.{2}/g)!.map((p) => parseInt(p, 16));
  return { octets, hex, error: '' };
}

function macBytes(hex: string): number[] {
  const pairs = hex.match(/.{2}/g) ?? [];
  return pairs.map((p) => parseInt(p, 16));
}

function eui64(hex: string): string {
  const bytes = macBytes(hex);
  bytes[0] = bytes[0]! ^ 2; // invert the U/L bit
  const groups = [bytes[0]!, bytes[1]!, bytes[2]!, 0xff, 0xfe, bytes[3]!, bytes[4]!, bytes[5]!];
  return groups.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (!['analyze', 'eui64'].includes(mode)) throw new ToolError('Choose analyze or eui64 mode.');
  const raw = input.text.trim();
  if (!raw)
    return {
      output: JSON.stringify({
        headers: ['MAC', 'Format', 'Vendor', 'EUI-64'],
        rows: [] as string[][],
      }),
      render: 'table',
      notes: ['Paste a MAC address to validate, decode and normalize, e.g. 3C:22:FB:9C:11:D4.'],
    };
  const parsed = parseMac(raw);
  if (parsed.error) throw new ToolError(parsed.error);
  const hex = parsed.hex;
  const bytes = parsed.octets;
  const firstByte = bytes[0] ?? 0;
  const isMulticast = (firstByte & 1) === 1;
  const isLocal = (firstByte & 2) === 2;
  const firstPair = hex.slice(0, 4);
  const vendor = VENDORS[firstPair] ?? VENDORS[hex.slice(0, 6)] ?? 'Unknown';
  if (mode === 'eui64') {
    const e64 = eui64(hex);
    return {
      output: e64,
      render: 'code',
      language: 'text',
      filename: 'eui64.txt',
      stats: { source: hex, eui64: e64 },
      notes: [
        `EUI-64 of ${hex} (U/L bit toggled, FF:FE inserted). Use with IPv6 prefix /64 for SLAAC.`,
      ],
    };
  }
  const normalized = bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const rows = [
    ['Normalized', normalized, 'AA:BB:CC:DD:EE:FF'],
    ['Format', detectFormat(raw), 'Detection of input notation'],
    ['Vendor (OUI)', hex.slice(0, 6), vendor],
    ['Multicast', isMulticast ? 'Yes' : 'No', 'Bit 0 of first octet'],
    ['Local bit', isLocal ? 'Locally administered' : 'Globally unique', 'Bit 1 of first octet'],
    ['EUI-64', eui64(hex), 'Interface identifier for SLAAC'],
  ];
  return {
    output: JSON.stringify({ headers: ['Attribute', 'Value', 'Detail'], rows }),
    render: 'table',
    stats: { valid: 'yes', multicast: isMulticast ? 'yes' : 'no', local: isLocal ? 'yes' : 'no' },
    notes: [
      vendor === 'Unknown'
        ? 'OUI not in the bundled map — could not guess a manufacturer.'
        : `Likely vendor: ${vendor}.`,
      'The OUI is informational; it does not prove who physically owns the device.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
