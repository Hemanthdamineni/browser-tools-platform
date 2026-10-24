/**
 * The online notepad panel.
 *
 * Owns the note list and the editor. Notes are autosaved to IndexedDB (through
 * an injectable {@link NoteStore}) as you type — debounced so rapid typing
 * coalesces into one write — and the pending save is flushed the moment the tab
 * is hidden or closed, so the very last edit is never lost.
 *
 * The storage layer is a small {@link NoteStore} interface. The production
 * implementation is an IndexedDB wrapper ({@link createIndexedDBStore}); tests
 * inject an in-memory store so the create / rename / delete / autosave /
 * last-write-wins behaviour can be exercised without a real database. All the
 * state transitions live in {@link NotepadController}, which has no DOM
 * dependency and is unit-tested directly.
 */
import { downloadText } from '@/lib/files';
import { buildExport, type Note } from '@/tools/text/online-notepad.tool';
import { showError } from '../workbench/shared';

/** How long to wait after an edit before autosaving, in milliseconds. */
const DEFAULT_AUTOSAVE_MS = 600;
/** The IndexedDB database name. */
const DB_NAME = 'online-notepad';
/** The object store that holds the notes. */
const STORE_NAME = 'notes';

/* -------------------------------------------------------------------------- */
/*  Storage                                                                   */
/* -------------------------------------------------------------------------- */

/** A small persistence contract the panel (and tests) talk to. */
export interface NoteStore {
  /** Every note, newest first. */
  list(): Promise<Note[]>;
  /** A single note by id, or null when it does not exist. */
  get(id: string): Promise<Note | null>;
  /** Create or replace a note (whole-record, last write wins per id). */
  put(note: Note): Promise<void>;
  /** Remove one note. */
  delete(id: string): Promise<void>;
  /** Remove every note. */
  clear(): Promise<void>;
}

/**
 * The production store: a tiny IndexedDB wrapper around a single object store
 * keyed by `note.id`. Nothing here talks to the network.
 */
export function createIndexedDBStore(dbName = DB_NAME, storeName = STORE_NAME): NoteStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB failed to open'));
      });
    }
    return dbPromise;
  }

  function tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(storeName, mode);
          const request = run(transaction.objectStore(storeName));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        }),
    );
  }

  function withCursor(
    mode: IDBTransactionMode,
    collect: (store: IDBObjectStore) => IDBRequest<IDBCursorWithValue | null>,
  ): Promise<Note[]> {
    return open().then(
      (db) =>
        new Promise<Note[]>((resolve, reject) => {
          const transaction = db.transaction(storeName, mode);
          const notes: Note[] = [];
          const request = collect(transaction.objectStore(storeName));
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              notes.push(cursor.value as Note);
              cursor.continue();
            } else {
              resolve(notes);
            }
          };
          request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        }),
    );
  }

  return {
    list() {
      return withCursor('readonly', (store) => store.openCursor());
    },
    async get(id) {
      const note = await tx<Note | undefined>('readonly', (store) => store.get(id));
      return note ?? null;
    },
    put(note) {
      return tx('readwrite', (store) => store.put(note)).then(() => undefined);
    },
    delete(id) {
      return tx('readwrite', (store) => store.delete(id)).then(() => undefined);
    },
    clear() {
      return tx('readwrite', (store) => store.clear()).then(() => undefined);
    },
  };
}

/** A tiny in-memory store, handy for tests. */
export function createMemoryStore(): NoteStore {
  const map = new Map<string, Note>();
  return {
    async list() {
      return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(note) {
      map.set(note.id, { ...note });
    },
    async delete(id) {
      map.delete(id);
    },
    async clear() {
      map.clear();
    },
  };
}

/** A fresh note id; falls back to a counter where `crypto` is absent. */
export function newNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/*  Debounce                                                                  */
/* -------------------------------------------------------------------------- */

/** A value scheduled for a deferred save. */
export interface DebouncedSaver {
  /** Queue `value` for `key`, replacing any earlier queued value. */
  schedule(key: string, value: unknown): void;
  /** Run any queued saves now, in order, returning when they settle. */
  flush(): Promise<void>;
  /** Whether anything is queued and not yet flushed. */
  pending(): boolean;
}

/**
 * Coalesce writes by key. Rapid `schedule`s for the same key collapse to the
 * latest value (last write wins), and a timer pushes them to `sink` after
 * `waitMs` of quiet. `flush()` runs any queued work immediately — this is what
 * `visibilitychange` and note switches use, so the final edit is never dropped.
 * A flush started while one is already in flight drains anything new that
 * arrived in between, keeping writes ordered.
 */
export function createDebouncedSaver(
  sink: (key: string, value: unknown) => void | Promise<void>,
  waitMs: number,
): DebouncedSaver {
  let timer: number | null = null;
  let flushing: Promise<void> | null = null;
  /** key to latest queued value. */
  const pending = new Map<string, unknown>();

  function drain(): Promise<void> {
    if (pending.size === 0) return Promise.resolve();
    const entries = [...pending.entries()];
    pending.clear();
    // Serialise so an earlier stale write can never land after a newer one.
    return entries.reduce(
      (chain, [key, value]) => chain.then(() => sink(key, value)).catch(() => undefined),
      Promise.resolve(),
    );
  }

  function flush(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!flushing) {
      flushing = drain().finally(() => {
        flushing = null;
        if (pending.size) void flush();
      });
    }
    return flushing;
  }

  return {
    schedule(key, value) {
      pending.set(key, value);
      if (timer === null) {
        timer = window.setTimeout(() => {
          timer = null;
          void flush();
        }, waitMs);
      }
    },
    flush,
    pending: () => pending.size > 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Controller                                                                */
/* -------------------------------------------------------------------------- */

/** What the panel needs to render: the notes and the current selection. */
export interface NotepadSnapshot {
  notes: Note[];
  current: Note | null;
  /** True when an edit is queued but not yet saved. */
  saving: boolean;
}

/** Dependencies the controller can take for testing (timers, clock, store). */
export interface ControllerDeps {
  store: NoteStore;
  /** Milliseconds to wait before autosaving. */
  autosaveMs?: number;
  /** Clock used for timestamps; defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Owns the notepad state and the autosave schedule. It talks only to a
 * {@link NoteStore} — no DOM — so the create / rename / delete / autosave /
 * last-write-wins rules are unit-testable in jsdom without a real database.
 */
export class NotepadController {
  /** All notes, newest first. */
  notes: Note[] = [];
  /** The id of the selected note, or null when none is open. */
  currentId: string | null = null;
  /** Invoked whenever the snapshot changes. */
  onUpdate?: (snapshot: NotepadSnapshot) => void;

  private readonly store: NoteStore;
  private readonly now: () => number;
  private readonly saver: DebouncedSaver;

  constructor(deps: ControllerDeps) {
    this.store = deps.store;
    this.now = deps.now ?? (() => Date.now());
    // Emit once a debounced write lands, so the panel can switch the status
    // from "Saving…" back to "Saved" and refresh the list order.
    this.saver = createDebouncedSaver(async (_key, value) => {
      await this.store.put(value as Note);
      this.emit();
    }, deps.autosaveMs ?? DEFAULT_AUTOSAVE_MS);
  }

  /** Load the notes and open the most recent one. */
  async init(): Promise<void> {
    this.notes = await this.store.list();
    if (this.notes.length) this.currentId = this.notes[0]!.id;
    this.emit();
  }

  private snapshot(): NotepadSnapshot {
    const current = this.currentId
      ? (this.notes.find((n) => n.id === this.currentId) ?? null)
      : null;
    return { notes: this.notes, current, saving: this.saver.pending() };
  }

  private emit(): void {
    this.onUpdate?.(this.snapshot());
  }

  /** The note currently open, or null. */
  current(): Note | null {
    return this.snapshot().current;
  }

  /** Create a new note and open it. Any pending edit is saved first. */
  async createNote(title = 'Untitled note'): Promise<Note> {
    await this.saver.flush();
    const note: Note = {
      id: newNoteId(),
      title,
      content: '',
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.notes.unshift(note);
    this.currentId = note.id;
    await this.store.put(note);
    this.emit();
    return note;
  }

  /** Rename a note. An explicit action, so it saves immediately. */
  async renameNote(id: string, title: string): Promise<void> {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;
    await this.saver.flush();
    note.title = title.trim() || 'Untitled note';
    note.updatedAt = this.now();
    this.resort(note);
    await this.store.put(note);
    this.emit();
  }

  /** Delete a note and move to the most recent remaining one. */
  async deleteNote(id: string): Promise<void> {
    await this.saver.flush();
    this.notes = this.notes.filter((n) => n.id !== id);
    if (this.currentId === id) this.currentId = this.notes[0]?.id ?? null;
    await this.store.delete(id);
    this.emit();
  }

  /** Delete every note. */
  async deleteAll(): Promise<void> {
    await this.saver.flush();
    this.notes = [];
    this.currentId = null;
    await this.store.clear();
    this.emit();
  }

  /** Open a different note, saving any pending edit first. */
  async selectNote(id: string): Promise<void> {
    if (id === this.currentId) return;
    await this.saver.flush();
    this.currentId = id;
    this.emit();
  }

  /** The user edited the current note. Schedule an autosave. */
  editContent(content: string): void {
    const note = this.current();
    if (!note) return;
    note.content = content;
    note.updatedAt = this.now();
    // Reorder in memory without rendering: a full re-render on every keystroke
    // would rebuild the list and fight the caret. The debounced save emits.
    this.resort(note);
    this.saver.schedule(note.id, { ...note });
  }

  /** Flush any pending edit now (used on `visibilitychange` / close). */
  async flush(): Promise<void> {
    await this.saver.flush();
  }

  /** Re-sort so the most recently edited note rises to the top. */
  private resort(note: Note): void {
    this.notes = this.notes
      .map((n) => (n.id === note.id ? note : n))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

/** A short, locale-aware timestamp for the note list. */
export function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mount the notepad into the `[data-online-notepad]` element. `store` defaults
 * to the IndexedDB store so the panel works out of the box; tests pass a
 * memory store instead.
 */
export function mountOnlineNotepadPanel(
  root: HTMLElement,
  store: NoteStore = createIndexedDBStore(),
): void {
  const listEl = root.querySelector<HTMLUListElement>('[data-note-list]')!;
  const newBtn = root.querySelector<HTMLButtonElement>('[data-new-note]')!;
  const deleteAllBtn = root.querySelector<HTMLButtonElement>('[data-delete-all]')!;
  const editorWrap = root.querySelector<HTMLElement>('[data-editor]')!;
  const titleInput = root.querySelector<HTMLInputElement>('[data-note-title]')!;
  const contentArea = root.querySelector<HTMLTextAreaElement>('[data-note-content]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-save-status]')!;
  const exportTxt = root.querySelector<HTMLButtonElement>('[data-export-txt]')!;
  const exportMd = root.querySelector<HTMLButtonElement>('[data-export-md]')!;
  const emptyState = root.querySelector<HTMLElement>('[data-empty-state]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;

  if (
    !listEl ||
    !newBtn ||
    !deleteAllBtn ||
    !editorWrap ||
    !titleInput ||
    !contentArea ||
    !statusEl ||
    !exportTxt ||
    !exportMd ||
    !emptyState ||
    !errorBox
  ) {
    return;
  }

  const controller = new NotepadController({ store });

  /** Draw the whole panel from a controller snapshot. */
  function render(snapshot: NotepadSnapshot): void {
    renderList(snapshot.notes);

    const hasCurrent = !!snapshot.current;
    editorWrap.hidden = !hasCurrent;
    emptyState.hidden = hasCurrent || snapshot.notes.length > 0;
    if (!hasCurrent) {
      titleInput.value = '';
      contentArea.value = '';
      statusEl.textContent = 'No note open.';
      return;
    }

    // Never overwrite a field the user is still typing into.
    const current = snapshot.current;
    if (!current) return;
    if (document.activeElement !== titleInput) titleInput.value = current.title;
    if (document.activeElement !== contentArea) contentArea.value = current.content;
    statusEl.textContent = snapshot.saving ? 'Saving…' : 'Saved to this browser.';
  }

  /** Render the note list with a select button and a per-note delete button. */
  function renderList(notes: Note[]): void {
    listEl.replaceChildren();
    for (const note of notes) {
      const item = document.createElement('li');
      item.dataset.noteId = note.id;
      item.className = 'rounded-md';

      const row = document.createElement('div');
      row.className =
        'flex items-center gap-2 rounded-md px-3 py-2 transition-colors' +
        (note.id === controller.currentId
          ? ' bg-[rgb(var(--accent-soft))]'
          : ' hover:bg-[rgb(var(--bg-inset))]');

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'min-w-0 flex-1 text-left';
      select.setAttribute('aria-pressed', String(note.id === controller.currentId));
      select.addEventListener('click', () => void controller.selectNote(note.id));
      row.appendChild(select);

      const title = document.createElement('span');
      title.className = 'block truncate text-sm font-medium';
      title.textContent = note.title;
      select.appendChild(title);

      const meta = document.createElement('span');
      meta.className = 'block text-[11px] text-[rgb(var(--text-muted))]';
      meta.textContent = formatTimestamp(note.updatedAt);
      select.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className =
        'btn btn-ghost btn-sm shrink-0 !px-2 !py-1' +
        (note.id === controller.currentId ? ' text-[rgb(var(--accent-strong))]' : '');
      del.dataset.noteAction = 'delete';
      del.setAttribute('aria-label', `Delete ${note.title}`);
      del.textContent = 'Delete';
      del.addEventListener('click', () => void controller.deleteNote(note.id));
      row.appendChild(del);

      item.appendChild(row);
      listEl.appendChild(item);
    }
  }

  titleInput.addEventListener('change', () => {
    const note = controller.current();
    if (!note) return;
    void controller.renameNote(note.id, titleInput.value);
  });

  contentArea.addEventListener('input', () => {
    controller.editContent(contentArea.value);
    statusEl.textContent = 'Saving…';
  });

  newBtn.addEventListener('click', () => void controller.createNote());
  deleteAllBtn.addEventListener('click', () => void controller.deleteAll());
  exportTxt.addEventListener('click', () => exportCurrent('txt'));
  exportMd.addEventListener('click', () => exportCurrent('md'));

  function exportCurrent(format: 'txt' | 'md'): void {
    const note = controller.current();
    if (!note) return;
    const out = buildExport(note, format);
    downloadText(out.output, out.filename, out.type);
  }

  // Never lose the last edit: flush before the tab is hidden or closed.
  const flushPending = (): void => void controller.flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
  window.addEventListener('pagehide', flushPending);
  window.addEventListener('beforeunload', flushPending);

  controller.onUpdate = render;
  void controller.init().catch(() => {
    showError(errorBox, 'Your notes could not be opened.', 'Reload the page to try again.');
  });
}
