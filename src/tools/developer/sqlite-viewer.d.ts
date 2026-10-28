/**
 * Minimal type surface for `sql.js` (MIT).
 *
 * The package ships no TypeScript types, so only the part `sqlite-viewer` uses
 * is declared: the module factory, the database handle and the shape of an
 * `exec()` result. The Emscripten glue is loaded with a dynamic `import()` in
 * `sqlite-viewer.tool.ts` so the wasm lands in its own worker chunk; the core
 * receives a ready `Database` and stays pure.
 */
declare module 'sql.js/dist/sql-wasm.js' {
  /** One statement's result: column names plus rows of raw SQLite values. */
  export interface QueryResult {
    columns: string[];
    values: unknown[][];
  }

  export interface Statement {
    bind(values: unknown[]): boolean;
    step(): boolean;
    get(): unknown[];
    getColumnNames(): string[];
    free(): boolean;
  }

  export interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): QueryResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
