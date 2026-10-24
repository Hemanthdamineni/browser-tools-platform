/**
 * `audio-to-wav` is a hidden alias of `audio-convert` (the registry's `build()`
 * requires a `.tool.ts` for every meta). The alias page redirects before any
 * run happens, so the implementation is the merge target's — no duplicated
 * logic here.
 */
export { default } from './audio-convert.tool';