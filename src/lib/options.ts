import type { OptionValues, ToolMeta, ToolOption } from './types';

/** The declared default for every option, as a plain object. */
export function optionDefaults(options: ToolOption[] | undefined): OptionValues {
  const out: OptionValues = {};
  for (const o of options ?? []) out[o.key] = o.default;
  return out;
}

/**
 * Merge caller-supplied option values over the tool's declared defaults.
 * Every `run()` should start with `const o = resolveOptions(meta, input.options)`
 * so it behaves the same whether called from the UI (values populated) or a test
 * (values omitted).
 */
export function resolveOptions(meta: ToolMeta, values: OptionValues | undefined): OptionValues {
  return { ...optionDefaults(meta.options), ...(values ?? {}) };
}
