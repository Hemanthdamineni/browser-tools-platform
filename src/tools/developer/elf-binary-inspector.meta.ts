import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'elf-binary-inspector',
  name: 'ELF Binary Inspector',
  category: 'developer',
  summary:
    'Parse an ELF/Linux binary on-device: class, type, machine, sections, symbols, deps and hardening.',
  description:
    'Open a Linux executable, shared object, kernel module or core file and read its ELF structure directly: 32- or 64-bit, little or big endian, object type (executable, PIE, shared object, relocatable, core), target machine and ABI, entry point, and the full program- and section-header tables. Beyond the headers it lists the dynamic library dependencies, exported and imported symbols from the symbol tables, and — most usefully — a build hardening verdict: whether the binary is position-independent (PIE), whether the RELRO segment is present and bound eagerly, whether the stack is marked non-executable, and whether stack-protector symbols are present. Each check states the evidence it used, so a missing feature is explained rather than merely flagged. Works on any ELF file; the bytes never leave your browser.',
  keywords: [
    'elf',
    'binary',
    'executable',
    'linux',
    'readelf',
    'symbols',
    'sections',
    'program headers',
    'pie',
    'relro',
    'nx',
    'hardening',
    'shared library',
    'so',
    'kernel module',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    '.so,.elf,.bin,.o,.ko,.out,application/octet-stream,application/x-executable,application/x-sharedlib',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'hardening', label: 'Hardening' },
        { value: 'sections', label: 'Sections' },
        { value: 'segments', label: 'Program headers' },
        { value: 'symbols', label: 'Symbols' },
        { value: 'dynamic', label: 'Dynamic' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Max rows listed',
      type: 'number',
      default: 100,
      min: 0,
    },
  ],
  examples: [{ title: 'Check whether a binary is hardened' }],
  related: [
    'binary-file-signature',
    'file-metadata',
    'font-inspector',
    'compressed-file-inspector',
  ],
  status: 'stable',
};
