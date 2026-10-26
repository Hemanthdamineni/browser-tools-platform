import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'plist-decoder',
  name: 'Property List Decoder',
  category: 'data',
  summary: 'Read binary and XML property lists (.plist): tree, types, object table and warnings.',
  description:
    'Open a property list from macOS or iOS and see what is really inside it. Binary (bplist00) and XML plists are detected automatically and decoded into the same tree, so a value can be compared across both formats. Strings, integers, reals, booleans, dates, data blobs, UIDs, arrays, sets and dictionaries are all decoded, with a flat tree of paths, a type summary, the raw binary object table, and findings for duplicate keys, cyclic references, unreachable objects, trailing bytes and oversized input.',
  keywords: [
    'plist decoder',
    'binary plist',
    'bplist00',
    'property list viewer',
    'info.plist',
    'macos preferences',
    'xml plist',
    'ios plist',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    '.plist,.xml,.strings,.txt,application/x-plist,application/xml,text/xml,text/plain,application/octet-stream',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'tree', label: 'Value tree' },
        { value: 'summary', label: 'Summary' },
        { value: 'objects', label: 'Binary object table' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'tree',
    },
    {
      key: 'dataPreview',
      label: 'Show data blobs as base64',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'A small XML plist',
      input:
        '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n\t<key>Name</key>\n\t<string>Example</string>\n\t<key>Build</key>\n\t<integer>42</integer>\n\t<key>Release</key>\n\t<true/>\n\t<key>Tags</key>\n\t<array>\n\t\t<string>alpha</string>\n\t\t<string>beta</string>\n\t</array>\n</dict>\n</plist>',
    },
    {
      title: 'Inspect the binary object table',
      options: { format: 'objects' },
    },
    {
      title: 'Read the structural findings',
      options: { format: 'findings' },
    },
  ],
  related: ['json-format', 'xml-format', 'cbor-decoder', 'hex'],
  status: 'stable',
};
