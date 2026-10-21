/**
 * Minimal type surfaces for `csso` (MIT) and `html-minifier-terser` (MIT).
 *
 * Both packages ship no types of their own, so only the part the code-minify
 * tool uses is declared here.
 */
declare module 'csso' {
  export interface MinifyOptions {
    /** Merge rules that share the same declarations. Defaults to `true`. */
    restructure?: boolean;
    /** Which comments to keep. Defaults to `'exclamation'`. */
    comments?: 'none' | 'exclamation' | 'first-exclamation' | boolean;
    /** Name of the source file, used in error messages and source maps. */
    filename?: string;
    /** Produce a source map. */
    sourceMap?: boolean;
  }

  export interface MinifyResult {
    /** The minified CSS. */
    css: string;
    /** The source map, when one was requested. */
    map: unknown;
  }

  export function minify(source: string, options?: MinifyOptions): MinifyResult;
}

declare module 'html-minifier-terser' {
  export interface Options {
    /** Collapse whitespace that is not significant. */
    collapseWhitespace?: boolean;
    /** Remove every comment, including conditional ones. */
    removeComments?: boolean;
    /** Remove attributes that repeat their default value. */
    removeRedundantAttributes?: boolean;
    /** Minify `<style>` blocks and inline `style` attributes. */
    minifyCSS?: boolean;
    /** Minify inline `<script>` elements. */
    minifyJS?: boolean;
    /** Replace `<!DOCTYPE html>` with its short form. */
    useShortDoctype?: boolean;
    /** Remove end tags the HTML spec allows to leave out. */
    removeOptionalTags?: boolean;
    /** Remove attributes whose value is empty. */
    removeEmptyAttributes?: boolean;
    /** Write `disabled` instead of `disabled=""`. */
    collapseBooleanAttributes?: boolean;
    /** Remove `type="text/javascript"` and friends. */
    removeScriptTypeAttributes?: boolean;
    /** Remove `type="text/css"` and friends. */
    removeStyleLinkTypeAttributes?: boolean;
    /** Drop the quotes around attribute values when that is safe. */
    removeAttributeQuotes?: boolean;
    /** Keep the closing slash on void elements. */
    keepClosingSlash?: boolean;
    /** Character to quote attribute values with. */
    quoteCharacter?: '"' | "'";
    [option: string]: unknown;
  }

  export function minify(value: string, options?: Options): Promise<string>;
}
