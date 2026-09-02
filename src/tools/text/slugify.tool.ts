import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './slugify.meta';

const CHAR_MAP: Record<string, string> = {
  '&': ' and ',
  '@': ' at ',
  '%': ' percent ',
  '+': ' plus ',
  '=': ' equals ',
  '€': ' euro ',
  $: ' dollar ',
  '£': ' pound ',
  '¥': ' yen ',
  '©': ' c ',
  '®': ' r ',
  '™': ' tm ',
};

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const sep = String(o.separator);
  let s = input.text;
  for (const [k, v] of Object.entries(CHAR_MAP)) s = s.split(k).join(v);
  s = s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  if (o.lowercase) s = s.toLowerCase();

  if (o.strict) {
    s = s.replace(/[^a-zA-Z0-9]+/g, ' ');
  } else {
    s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  }
  s = s.trim().replace(/\s+/g, sep || '');

  const max = Number(o.maxLength) || 0;
  if (max > 0 && s.length > max) {
    s = s.slice(0, max);
    if (sep)
      s =
        s.replace(new RegExp(`\\${sep}[^\\${sep}]*$`), '').replace(new RegExp(`\\${sep}+$`), '') ||
        s;
  }
  if (sep) {
    const esc = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`^${esc}+|${esc}+$`, 'g'), '');
  }

  return { output: s, render: 'code', stats: { length: s.length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
