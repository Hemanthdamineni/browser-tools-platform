/**
 * Minimal type surface for `sql.js` (MIT).
 *
 * sql.js ships the Emscripten-compiled SQLite build as plain JavaScript with no
 * bundled types. Only the parts the viewer uses are declared here — the
 * `initSqlJs` factory, the options it understands, and the `Database` methods
 * the tool calls. The shapes are written in terms of the viewer's own
 * `SqlCell` / `QueryResult` interfaces (`sqlite-viewer.core.ts`) so the
 * declaration and the code cannot drift apart.
 *
 * The package's browser entry (`dist/sql-wasm-browser.js`) is CommonJS — the
 * emcc shell ends with `module.exports = initSqlJs` — so the bundler hands the
 * factory over as the default export, exactly like `@jspawn/qpdf-wasm` in
 * `pdf-protect.qpdf.ts`. The `.wasm` is fetched from this origin through
 * `locateFile` (see `sqlite-viewer.tool.ts`).
 */
declare module 'sql.js/dist/sql-wasm-browser.js' {
  export type SqlCell = string | number | null | Uint8Array;

  export interface SqlJsDatabase {
    /** Run a statement that returns no rows (used to create the test fixture). */
    run(sql: string, params?: unknown): void;
    /** Run a read-only query; returns the result sets (columns + values). */
    exec(sql: string): { columns: string[]; values: SqlCell[][] }[];
    close(): void;
    getRowsModified(): number;
    export(): Uint8Array;
  }

  export interface SqlJsInitOptions {
    /** Resolve `sql-wasm-browser.wasm` (the built asset URL of this site). */
    locateFile?: (file: string) => string;
    /** Inline wasm bytes; used by tests to skip the network fetch. */
    wasmBinary?: ArrayBuffer | Uint8Array;
  }

  export interface SqlJsModule {
    /** Open an in-memory database, optionally seeded from the given bytes. */
    Database: new (data?: ArrayBuffer | Uint8Array | null) => SqlJsDatabase;
  }

  /** `initSqlJs(config)` resolves to the loaded sql.js module. */
  const initSqlJs: (config?: SqlJsInitOptions) => Promise<SqlJsModule>;
  export default initSqlJs;
}