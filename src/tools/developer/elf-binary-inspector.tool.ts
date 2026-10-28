import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './elf-binary-inspector.meta';

/**
 * ELF structure inspector.
 *
 * Parses the ELF header, program headers and section headers, then reads the
 * section header string table, the dynamic section, and the symbol tables.
 * Verdicts in the tests come from the reference tools `readelf` and `nm`, not
 * from this parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ROWS = 5000;

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46];

const TYPES: Record<number, string> = {
  0: 'NONE',
  1: 'REL (relocatable object)',
  2: 'EXEC (executable)',
  3: 'DYN (shared object / PIE)',
  4: 'CORE (core dump)',
};

const MACHINES: Record<number, string> = {
  0: 'None',
  2: 'SPARC',
  3: 'Intel 80386',
  8: 'MIPS',
  20: 'PowerPC',
  21: 'PowerPC64',
  22: 'S390',
  40: 'ARM',
  42: 'SuperH',
  43: 'SPARC v9',
  50: 'IA-64',
  62: 'AMD x86-64',
  183: 'AArch64',
  243: 'RISC-V',
  247: 'BPF',
  258: 'LoongArch',
};

/** Section header types we name; everything else prints the raw number. */
const SH_TYPES: Record<number, string> = {
  0: 'NULL',
  1: 'PROGBITS',
  2: 'SYMTAB',
  3: 'STRTAB',
  4: 'RELA',
  5: 'HASH',
  6: 'DYNAMIC',
  7: 'NOTE',
  8: 'NOBITS',
  9: 'REL',
  10: 'SHLIB',
  11: 'DYNSYM',
  14: 'INIT_ARRAY',
  15: 'FINI_ARRAY',
  16: 'PREINIT_ARRAY',
  17: 'GROUP',
  18: 'SYMTAB_SHNDX',
  19: 'RELR',
};

const PH_TYPES: Record<number, string> = {
  0: 'NULL',
  1: 'LOAD',
  2: 'DYNAMIC',
  3: 'INTERP',
  4: 'NOTE',
  5: 'SHLIB',
  6: 'PHDR',
  7: 'TLS',
  0x6474e550: 'GNU_EH_FRAME',
  0x6474e551: 'GNU_STACK',
  0x6474e552: 'GNU_RELRO',
  0x6474e553: 'GNU_PROPERTY',
};

/** Dynamic tags we care about for the hardening verdict. */
const DT_BIND_NOW = 24;
const DT_FLAGS = 30;
const DT_FLAGS_1 = 0x6ffffffb;
const DF_BIND_NOW = 0x8;
const DF_1_PIE = 0x08000000;

const SHT_SYMTAB = 2;
const SHT_DYNSYM = 11;
const SHT_STRTAB = 3;
const SHT_DYNAMIC = 6;

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  kind: string;
  detail: string;
}

interface Section {
  index: number;
  name: string;
  type: number;
  flags: number;
  addr: number;
  offset: number;
  size: number;
  link: number;
  entsize: number;
}

interface Segment {
  type: number;
  flags: number;
  offset: number;
  vaddr: number;
  filesz: number;
  memsz: number;
  align: number;
}

interface Symbol {
  name: string;
  value: number;
  size: number;
  bind: string;
  type: string;
  defined: boolean;
}

interface Model {
  is64: boolean;
  little: boolean;
  type: number;
  machine: number;
  entry: number;
  osabi: number;
  sections: Section[];
  segments: Segment[];
  symbols: Symbol[];
  dynNeeded: string[];
  dynRunpath: string | null;
  dynRpath: string | null;
  bindNow: boolean;
  pieFlag: boolean;
  findings: Finding[];
  classLabel: string;
  abi: string;
}

class Reader {
  readonly b: Uint8Array;
  readonly little: boolean;
  readonly is64: boolean;
  oob = false;

  constructor(b: Uint8Array, little: boolean, is64: boolean) {
    this.b = b;
    this.little = little;
    this.is64 = is64;
  }

  u8(at: number): number {
    if (at < 0 || at >= this.b.length) {
      this.oob = true;
      return 0;
    }
    return this.b[at]!;
  }

  u16(at: number): number {
    if (at < 0 || at + 2 > this.b.length) {
      this.oob = true;
      return 0;
    }
    return this.little
      ? this.b[at]! | (this.b[at + 1]! << 8)
      : (this.b[at]! << 8) | this.b[at + 1]!;
  }

  u32(at: number): number {
    if (at < 0 || at + 4 > this.b.length) {
      this.oob = true;
      return 0;
    }
    const b = this.b;
    return this.little
      ? (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0
      : ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
  }

  /** 64-bit values are returned as Number; files above 2^53 in an offset are refused. */
  u64(at: number): number {
    if (at < 0 || at + 8 > this.b.length) {
      this.oob = true;
      return 0;
    }
    const hi = this.u32(this.little ? at + 4 : at);
    const lo = this.u32(this.little ? at : at + 4);
    const value = hi * 4294967296 + lo;
    return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  /** Address-sized value: 8 bytes in ELF64, 4 in ELF32. */
  addr(at: number): number {
    return this.is64 ? this.u64(at) : this.u32(at);
  }

  cstr(at: number, limit = 512): string {
    if (at < 0 || at >= this.b.length) return '';
    let out = '';
    for (let i = at; i < this.b.length && i < at + limit; i += 1) {
      const c = this.b[i]!;
      if (c === 0) break;
      out += String.fromCharCode(c);
    }
    return out;
  }
}

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

function parseElf(bytes: Uint8Array): Model {
  const findings: Finding[] = [];

  if (bytes.length < 16 || ELF_MAGIC.some((v, i) => bytes[i] !== v))
    throw new ToolError(
      'That file is not an ELF binary.',
      'An ELF file starts with the bytes 7F 45 4C 46.',
    );

  const ident = bytes;
  const eiClass = ident[4]!;
  const eiData = ident[5]!;
  const osabi = ident[7]!;

  if (eiClass !== 1 && eiClass !== 2)
    throw new ToolError(
      'That ELF file has an unknown class.',
      `ELF class byte ${eiClass} is neither 32-bit (1) nor 64-bit (2).`,
    );
  if (eiData !== 1 && eiData !== 2)
    throw new ToolError(
      'That ELF file has an unknown byte order.',
      `ELF data byte ${eiData} is neither little (1) nor big endian (2).`,
    );

  const is64 = eiClass === 2;
  const little = eiData === 1;
  const r = new Reader(bytes, little, is64);

  const eType = r.u16(16);
  const eMachine = r.u16(18);
  const eEntry = r.addr(24);
  const phoff = r.addr(is64 ? 32 : 28);
  const shoff = r.addr(is64 ? 40 : 32);
  const phentsize = r.u16(is64 ? 54 : 42);
  const phnum = r.u16(is64 ? 56 : 44);
  const shentsize = r.u16(is64 ? 58 : 46);
  const shnum = r.u16(is64 ? 60 : 48);
  const shstrndx = r.u16(is64 ? 62 : 50);

  if (r.oob)
    throw new ToolError(
      'That ELF file is truncated.',
      `The file is only ${bytes.length} bytes, too short for a ${is64 ? '64' : '32'}-bit ELF header.`,
    );

  // --- Section headers -----------------------------------------------------
  const sections: Section[] = [];
  const shLimit = Math.min(shnum, 100000);
  for (let i = 0; i < shLimit; i += 1) {
    const at = shoff + i * shentsize;
    if (shentsize < (is64 ? 64 : 40) || at + shentsize > bytes.length) {
      findings.push({
        severity: 'error',
        kind: 'section-header-oob',
        detail: `Section header ${i} at byte ${at} lies outside the ${bytes.length}-byte file.`,
      });
      break;
    }
    sections.push(
      is64
        ? {
            index: i,
            name: '',
            type: r.u32(at + 4),
            flags: r.u64(at + 8),
            addr: r.u64(at + 16),
            offset: r.u64(at + 24),
            size: r.u64(at + 32),
            link: r.u32(at + 40),
            entsize: r.u64(at + 56),
          }
        : {
            index: i,
            name: '',
            type: r.u32(at + 4),
            flags: r.u32(at + 8),
            addr: r.u32(at + 12),
            offset: r.u32(at + 16),
            size: r.u32(at + 20),
            link: r.u32(at + 24),
            entsize: r.u32(at + 36),
          },
    );
  }

  // Resolve section names from the section header string table.
  const nameOff = is64 ? 24 : 16;
  const strtab = sections[shstrndx];
  if (strtab && strtab.type === SHT_STRTAB) {
    for (const section of sections) {
      const at = shoff + section.index * shentsize;
      section.name = r.cstr(strtab.offset + r.u32(at), 256);
    }
  } else if (sections.length > 0) {
    findings.push({
      severity: 'warn',
      kind: 'no-section-names',
      detail: `The section-header string table index ${shstrndx} does not point at a string table.`,
    });
  }
  void nameOff;

  // --- Program headers ----------------------------------------------------
  const segments: Segment[] = [];
  const phLimit = Math.min(phnum, 10000);
  for (let i = 0; i < phLimit; i += 1) {
    const at = phoff + i * phentsize;
    if (phentsize < (is64 ? 56 : 32) || at + phentsize > bytes.length) {
      findings.push({
        severity: 'error',
        kind: 'program-header-oob',
        detail: `Program header ${i} at byte ${at} lies outside the ${bytes.length}-byte file.`,
      });
      break;
    }
    segments.push(
      is64
        ? {
            type: r.u32(at),
            flags: r.u32(at + 4),
            offset: r.u64(at + 8),
            vaddr: r.u64(at + 16),
            filesz: r.u64(at + 32),
            memsz: r.u64(at + 40),
            align: r.u64(at + 48),
          }
        : {
            type: r.u32(at),
            offset: r.u32(at + 4),
            vaddr: r.u32(at + 8),
            filesz: r.u32(at + 16),
            memsz: r.u32(at + 20),
            flags: r.u32(at + 24),
            align: r.u32(at + 28),
          },
    );
  }

  // --- Dynamic section ----------------------------------------------------
  const dynNeeded: string[] = [];
  let dynRunpath: string | null = null;
  let dynRpath: string | null = null;
  let bindNow = false;
  let pieFlag = false;

  const dynSection = sections.find((s) => s.type === SHT_DYNAMIC);
  if (dynSection) {
    const strSection = sections[dynSection.link];
    const stride = is64 ? 16 : 8;
    const count = dynSection.entsize > 0 ? Math.floor(dynSection.size / dynSection.entsize) : 0;
    for (let i = 0; i < Math.min(count, 512); i += 1) {
      const at = dynSection.offset + i * stride;
      const tag = is64 ? r.u64(at) : r.u32(at);
      const val = is64 ? r.u64(at + 8) : r.u32(at + 4);
      if (tag === 0) break;
      const libName = strSection ? r.cstr(strSection.offset + val, 512) : '';
      if (tag === 1 && libName) dynNeeded.push(libName);
      else if (tag === 15) dynRunpath = libName;
      else if (tag === 29) dynRpath = libName;
      else if (tag === DT_BIND_NOW) bindNow = true;
      else if (tag === DT_FLAGS && (val & DF_BIND_NOW) !== 0) bindNow = true;
      else if (tag === DT_FLAGS_1 && (val & DF_1_PIE) !== 0) pieFlag = true;
    }
  }

  // The ELF *header* type is the authoritative PIE signal for an executable.
  const headerSaysPie = eType === 3 && pieFlag;
  void headerSaysPie;

  // --- Symbols ------------------------------------------------------------
  const symbols: Symbol[] = [];
  for (const section of sections) {
    if (section.type !== SHT_SYMTAB && section.type !== SHT_DYNSYM) continue;
    const strSection = sections[section.link];
    const stride = section.entsize > 0 ? section.entsize : is64 ? 24 : 16;
    const count = stride > 0 ? Math.floor(section.size / stride) : 0;
    const limit = Math.min(count, 20000);
    for (let i = 1; i < limit; i += 1) {
      const at = section.offset + i * stride;
      if (at + stride > bytes.length) break;
      const nameOff2 = r.u32(at);
      const info = r.u8(at + (is64 ? 4 : 12));
      const shndx = r.u16(at + (is64 ? 6 : 14));
      const value = is64 ? r.u64(at + 8) : r.u32(at + 4);
      const size = is64 ? r.u64(at + 16) : r.u32(at + 8);
      const name = strSection ? r.cstr(strSection.offset + nameOff2, 256) : '';
      if (!name) continue;
      const bindCode = info >>> 4;
      const typeCode = info & 0x0f;
      symbols.push({
        name,
        value,
        size,
        bind: ['LOCAL', 'GLOBAL', 'WEAK', 'OBJECT'][bindCode] ?? `bind${bindCode}`,
        type:
          ['NOTYPE', 'OBJECT', 'FUNC', 'SECTION', 'FILE', 'COMMON', 'TLS'][typeCode] ??
          `type${typeCode}`,
        defined: shndx !== 0,
      });
      if (symbols.length >= 40000) break;
    }
  }

  // --- Hardening checks ---------------------------------------------------
  const relro = segments.find((s) => s.type === 0x6474e552);
  const stack = segments.find((s) => s.type === 0x6474e551);
  const hasInterp = segments.some((s) => s.type === 3);
  const execStack = stack !== undefined && (stack.flags & 0x1) !== 0;
  const isExecutable = eType === 2 || (eType === 3 && pieFlag);

  if (eType === 3 && !hasInterp && !sections.some((s) => s.name === '.interp')) {
    findings.push({
      severity: 'info',
      kind: 'shared-object',
      detail: 'DYN with no interpreter: this is a shared library, not a runnable executable.',
    });
  }
  if (!relro && (isExecutable || hasInterp)) {
    findings.push({
      severity: 'warn',
      kind: 'no-relro',
      detail:
        'No GNU_RELRO segment: the GOT and other dynamic data stay writable after relocation.',
    });
  }
  if (relro && isExecutable && !bindNow) {
    findings.push({
      severity: 'info',
      kind: 'partial-relro',
      detail:
        'GNU_RELRO is present but the dynamic section has no BIND_NOW flag: this is partial RELRO.',
    });
  }
  if (stack === undefined && (isExecutable || hasInterp)) {
    findings.push({
      severity: 'warn',
      kind: 'no-gnu-stack',
      detail: 'No GNU_STACK segment: the kernel assumes an executable stack for this binary.',
    });
  }
  if (execStack) {
    findings.push({
      severity: 'error',
      kind: 'executable-stack',
      detail: 'The GNU_STACK segment is marked executable (RWE), which defeats NX protection.',
    });
  }
  const hasStackChk = symbols.some((s) => s.name.includes('__stack_chk_fail'));
  const looksC = sections.some((s) => s.name === '.text');
  if (isExecutable && looksC && !hasStackChk) {
    findings.push({
      severity: 'info',
      kind: 'no-stack-canary',
      detail:
        'No __stack_chk_fail reference: the binary was probably built without -fstack-protector.',
    });
  }
  if (isExecutable && eType === 2) {
    findings.push({
      severity: 'warn',
      kind: 'not-pie',
      detail:
        'ELF type is EXEC, not DYN: the binary is not position independent (no PIE/ASLR for code).',
    });
  }

  const abiNames: Record<number, string> = {
    0: 'System V',
    1: 'HP-UX',
    2: 'NetBSD',
    3: 'Linux/GNU',
    6: 'Solaris',
    9: 'FreeBSD',
    12: 'OpenBSD',
  };

  if (symbols.length === 0 && sections.length > 0) {
    findings.push({
      severity: 'info',
      kind: 'stripped',
      detail: 'No symbol table entries: the binary appears to be stripped.',
    });
  }

  return {
    is64,
    little,
    type: eType,
    machine: eMachine,
    entry: eEntry,
    osabi,
    sections,
    segments,
    symbols,
    dynNeeded,
    dynRunpath,
    dynRpath,
    bindNow,
    pieFlag,
    findings,
    classLabel: `${is64 ? 'ELF64' : 'ELF32'} ${little ? 'little' : 'big'}-endian`,
    abi: abiNames[osabi] ?? `OSABI ${osabi}`,
  };
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const errors = m.findings.filter((f) => f.severity === 'error').length;
  const warns = m.findings.filter((f) => f.severity === 'warn').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Class', m.classLabel],
      ['Type', TYPES[m.type] ?? `type ${m.type}`],
      ['Machine', MACHINES[m.machine] ?? `machine ${m.machine} (${hex(m.machine)})`],
      ['OS/ABI', m.abi],
      ['Entry point', hex(m.entry)],
      ['Program headers', String(m.segments.length)],
      ['Section headers', String(m.sections.length)],
      ['Symbols', String(m.symbols.length)],
      ['Dynamic libraries', String(m.dynNeeded.length)],
      ['Findings', `${errors} error, ${warns} warning, ${m.findings.length - errors - warns} note`],
    ],
  };
}

function tableHardening(m: Model): { headers: string[]; rows: string[][] } {
  const relro = m.segments.find((s) => s.type === 0x6474e552);
  const stack = m.segments.find((s) => s.type === 0x6474e551);
  const canary = m.symbols.some((s) => s.name.includes('__stack_chk_fail'));
  const isExec = m.type === 2 || m.type === 3;
  return {
    headers: ['Check', 'Result', 'Evidence'],
    rows: [
      [
        'PIE / position independent',
        m.type === 3 && m.pieFlag ? 'yes' : m.type === 3 ? 'DYN (shared object)' : 'no',
        m.type === 3 && m.pieFlag
          ? 'DT_FLAGS_1 has DF_1_PIE'
          : m.type === 2
            ? 'e_type is EXEC, not DYN'
            : 'e_type is DYN without DF_1_PIE',
      ],
      [
        'RELRO',
        relro === undefined ? 'absent' : m.bindNow ? 'full' : 'partial',
        relro === undefined
          ? 'no GNU_RELRO segment'
          : m.bindNow
            ? 'GNU_RELRO + BIND_NOW'
            : 'GNU_RELRO without BIND_NOW',
      ],
      [
        'NX / non-executable stack',
        stack === undefined ? 'unknown' : (stack.flags & 0x1) !== 0 ? 'NO (executable)' : 'yes',
        stack === undefined ? 'no GNU_STACK segment' : `GNU_STACK flags ${hex(stack.flags)}`,
      ],
      [
        'Stack canary',
        canary ? 'present' : isExec ? 'not found' : 'n/a',
        canary ? '__stack_chk_fail referenced' : 'no __stack_chk_fail symbol',
      ],
      [
        'Stripped',
        m.symbols.length === 0 ? 'yes' : 'no',
        `${m.symbols.length} symbol table entries`,
      ],
    ],
  };
}

function tableSections(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.sections.slice(0, max) : [];
  return {
    headers: ['#', 'Name', 'Type', 'Address', 'Offset', 'Size', 'Flags'],
    rows: shown.map((s) => [
      String(s.index),
      s.name === '' ? '(null)' : s.name,
      SH_TYPES[s.type] ?? String(s.type),
      hex(s.addr),
      hex(s.offset),
      formatBytes(s.size),
      [
        (s.flags & 0x1) !== 0 ? 'W' : '',
        (s.flags & 0x2) !== 0 ? 'A' : '',
        (s.flags & 0x4) !== 0 ? 'X' : '',
      ].join('') || '-',
    ]),
  };
}

function tableSegments(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.segments.slice(0, max) : [];
  return {
    headers: ['Type', 'Flags', 'Offset', 'Vaddr', 'File size', 'Mem size', 'Align'],
    rows: shown.map((s) => [
      PH_TYPES[s.type] ?? hex(s.type),
      [
        (s.flags & 0x4) !== 0 ? 'R' : '',
        (s.flags & 0x2) !== 0 ? 'W' : '',
        (s.flags & 0x1) !== 0 ? 'E' : '',
      ].join('') || '-',
      hex(s.offset),
      hex(s.vaddr),
      formatBytes(s.filesz),
      formatBytes(s.memsz),
      hex(s.align),
    ]),
  };
}

function tableSymbols(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.symbols.slice(0, max) : [];
  return {
    headers: ['Name', 'Bind', 'Type', 'Value', 'Size', 'Defined'],
    rows: shown.map((s) => [
      s.name,
      s.bind,
      s.type,
      hex(s.value),
      formatBytes(s.size),
      s.defined ? 'yes' : 'no (undef)',
    ]),
  };
}

function tableDynamic(m: Model): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  const hasDynamic =
    m.dynNeeded.length > 0 ||
    m.dynRunpath !== null ||
    m.dynRpath !== null ||
    m.bindNow ||
    m.pieFlag ||
    m.segments.some((s) => s.type === 2);
  if (!hasDynamic) {
    return {
      headers: ['Tag', 'Value'],
      rows: [['—', 'No dynamic section: statically linked (or fully stripped)']],
    };
  }
  for (const lib of m.dynNeeded) rows.push(['NEEDED', lib]);
  if (m.dynRunpath !== null) rows.push(['RUNPATH', m.dynRunpath]);
  if (m.dynRpath !== null) rows.push(['RPATH', m.dynRpath]);
  rows.push(['BIND_NOW', m.bindNow ? 'yes' : 'no']);
  rows.push(['DF_1_PIE', m.pieFlag ? 'yes' : 'no']);
  return { headers: ['Tag', 'Value'], rows };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No binary was provided.', 'Choose an ELF file to inspect.');

  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES)
    throw new ToolError(
      'That file is larger than 256 MB.',
      'The whole file is read into memory to follow its offset tables.',
    );

  const bytes = new Uint8Array(await source.arrayBuffer());
  const model = parseElf(bytes);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'hardening':
      table = tableHardening(model);
      break;
    case 'sections':
      table = tableSections(model, maxRows);
      break;
    case 'segments':
      table = tableSegments(model, maxRows);
      break;
    case 'symbols':
      table = tableSymbols(model, maxRows);
      break;
    case 'dynamic':
      table = tableDynamic(model);
      break;
    case 'summary':
      table = tableSummary(model);
      break;
    default:
      table = tableSummary(model);
      warnings.push(`Unknown view "${format}" — showing the summary instead.`);
  }

  const errors = model.findings.filter((f) => f.severity === 'error').length;
  return {
    outputs: [],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      `${model.classLabel} ${TYPES[model.type] ?? 'type ' + model.type}: ` +
        `${model.sections.length} sections, ${model.segments.length} segments, ` +
        `${model.symbols.length} symbols, ${errors} error(s).`,
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      sections: model.sections.length,
      segments: model.segments.length,
      symbols: model.symbols.length,
      findings: model.findings.length,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
