import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '@/lib/files';
import {
  NotepadController,
  createDebouncedSaver,
  createMemoryStore,
  formatTimestamp,
  mountOnlineNotepadPanel,
  type NoteStore,
} from './online-notepad-panel';
import { buildExport, type Note } from '@/tools/text/online-notepad.tool';

// The panel downloads exports through this helper; stub it so no real anchor
// click or object URL is involved.
vi.mock('@/lib/files', () => ({ downloadText: vi.fn() }));
const downloadTextMock = vi.mocked(downloadText);

/** A note with the given fields. */
function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'My note',
    content: 'hello',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

/** A store that records every write so the tests can assert on ordering. */
function spyStore(seed: Note[] = []): NoteStore & { writes: Note[]; deletes: string[] } {
  const writes: Note[] = [];
  const deletes: string[] = [];
  const inner = createMemoryStore();
  for (const n of seed) inner.put(n);
  return {
    writes,
    deletes,
    list: () => inner.list(),
    get: (id) => inner.get(id),
    async put(n) {
      writes.push({ ...n });
      await inner.put(n);
    },
    async delete(id) {
      deletes.push(id);
      await inner.delete(id);
    },
    clear: () => inner.clear(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  downloadTextMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('debounced saver', () => {
  it('waits for the quiet period and writes only once for rapid edits', async () => {
    const sink = vi.fn();
    const saver = createDebouncedSaver(sink, 500);

    saver.schedule('n1', 'a');
    saver.schedule('n1', 'b');
    saver.schedule('n1', 'c');
    expect(sink).not.toHaveBeenCalled();
    expect(saver.pending()).toBe(true);

    await vi.advanceTimersByTimeAsync(499);
    expect(sink).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(sink).toHaveBeenCalledTimes(1);
    // Last write wins: only the newest value reaches the sink.
    expect(sink).toHaveBeenCalledWith('n1', 'c');
    expect(saver.pending()).toBe(false);
  });

  it('flushes a pending value immediately, so the last edit is never lost', async () => {
    const sink = vi.fn();
    const saver = createDebouncedSaver(sink, 500);
    saver.schedule('n1', 'final');
    // The tab is hidden before the debounce fires.
    await saver.flush();
    expect(sink).toHaveBeenCalledWith('n1', 'final');
    expect(saver.pending()).toBe(false);
    // The cancelled timer must not fire a second write.
    await vi.advanceTimersByTimeAsync(1000);
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('keeps writes for different keys in order', async () => {
    const order: string[] = [];
    const saver = createDebouncedSaver(async (key) => {
      order.push(key);
    }, 100);
    saver.schedule('a', 1);
    saver.schedule('b', 2);
    await vi.advanceTimersByTimeAsync(100);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('NotepadController', () => {
  it('loads the newest note and opens it', async () => {
    const store = spyStore([
      note({ id: 'old', updatedAt: 1_000 }),
      note({ id: 'new', updatedAt: 2_000 }),
    ]);
    const controller = new NotepadController({ store });
    await controller.init();
    expect(controller.notes.map((n) => n.id)).toEqual(['new', 'old']);
    expect(controller.current()?.id).toBe('new');
  });

  it('creates a note, persists it and selects it', async () => {
    const store = spyStore();
    const controller = new NotepadController({ store, now: () => 12_345 });
    await controller.init();
    const created = await controller.createNote('Groceries');
    expect(created.title).toBe('Groceries');
    expect(created.createdAt).toBe(12_345);
    expect(controller.current()?.id).toBe(created.id);
    expect((await store.list()).map((n) => n.id)).toEqual([created.id]);
  });

  it('renames a note and persists the new title', async () => {
    const store = spyStore([note({ id: 'n1', title: 'Old' })]);
    const controller = new NotepadController({ store });
    await controller.init();
    await controller.renameNote('n1', '  New title  ');
    expect((await store.get('n1'))?.title).toBe('New title');
  });

  it('falls back to a default title when a rename is blank', async () => {
    const store = spyStore([note({ id: 'n1', title: 'Old' })]);
    const controller = new NotepadController({ store });
    await controller.init();
    await controller.renameNote('n1', '   ');
    expect((await store.get('n1'))?.title).toBe('Untitled note');
  });

  it('deletes a note and moves to the next one', async () => {
    const store = spyStore([
      note({ id: 'a', updatedAt: 2_000 }),
      note({ id: 'b', updatedAt: 1_000 }),
    ]);
    const controller = new NotepadController({ store });
    await controller.init();
    await controller.deleteNote('a');
    expect(store.deletes).toEqual(['a']);
    expect(controller.notes.map((n) => n.id)).toEqual(['b']);
    expect(controller.current()?.id).toBe('b');
  });

  it('deletes every note', async () => {
    const store = spyStore([note({ id: 'a' })]);
    const controller = new NotepadController({ store });
    await controller.init();
    await controller.deleteAll();
    expect(await store.list()).toEqual([]);
    expect(controller.current()).toBeNull();
  });

  it('autosaves an edit once the debounce elapses, keeping the last write', async () => {
    const store = spyStore([note({ id: 'n1', content: '' })]);
    const controller = new NotepadController({ store, autosaveMs: 400, now: () => 9_000 });
    await controller.init();

    controller.editContent('v1');
    controller.editContent('v2');
    expect(store.writes).toEqual([]);

    await vi.advanceTimersByTimeAsync(400);
    expect(store.writes.map((n) => n.content)).toEqual(['v2']);
    expect((await store.get('n1'))?.content).toBe('v2');
  });

  it('flushes a pending edit on demand (visibilitychange)', async () => {
    const store = spyStore([note({ id: 'n1', content: '' })]);
    const controller = new NotepadController({ store, autosaveMs: 5_000 });
    await controller.init();

    controller.editContent('typed then hidden');
    // No timer advance: the tab was hidden and flushed immediately.
    await controller.flush();
    expect((await store.get('n1'))?.content).toBe('typed then hidden');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(store.writes).toHaveLength(1);
  });

  it('writes the newest edit last when a flush is already in flight', async () => {
    const store = spyStore([note({ id: 'n1', content: 'v1' })]);
    const controller = new NotepadController({ store, autosaveMs: 5_000 });
    await controller.init();

    controller.editContent('v2');
    const inFlight = controller.flush();
    controller.editContent('v3');
    await inFlight;
    await controller.flush();

    expect(store.writes.map((n) => n.content)).toEqual(['v2', 'v3']);
    expect((await store.get('n1'))?.content).toBe('v3');
  });

  it('saves the pending edit before switching notes', async () => {
    const store = spyStore([
      note({ id: 'a', content: '', updatedAt: 2_000 }),
      note({ id: 'b', content: '', updatedAt: 1_000 }),
    ]);
    const controller = new NotepadController({ store, autosaveMs: 5_000 });
    await controller.init();
    expect(controller.current()?.id).toBe('a');

    controller.editContent('draft on a');
    await controller.selectNote('b');
    expect((await store.get('a'))?.content).toBe('draft on a');
    expect(controller.current()?.id).toBe('b');
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

/** The markup OnlineNotepad.astro renders, in the parts the panel uses. */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.onlineNotepad = '';
  root.dataset.toolId = 'online-notepad';
  root.innerHTML = `
    <button type="button" data-new-note>New note</button>
    <button type="button" data-delete-all>Delete all notes</button>
    <ul data-note-list></ul>
    <div data-editor hidden>
      <input type="text" data-note-title />
      <button type="button" data-export-txt>.txt</button>
      <button type="button" data-export-md>.md</button>
      <textarea data-note-content></textarea>
      <p data-save-status role="status"></p>
    </div>
    <div data-empty-state></div>
    <div data-error hidden></div>
  `;
  document.body.append(root);
  return root;
}

/** Mount the panel and let its async init settle. */
async function mount(root: HTMLElement, store: NoteStore): Promise<void> {
  mountOnlineNotepadPanel(root, store);
  await vi.advanceTimersByTimeAsync(0);
}

/** The titles currently shown in the note list. */
function listTitles(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-note-list] li')).map(
    (item) => item.querySelector('span')?.textContent ?? '',
  );
}

/** Type into the note body the way a user does. */
function typeBody(root: HTMLElement, value: string): void {
  const area = root.querySelector<HTMLTextAreaElement>('[data-note-content]')!;
  area.value = value;
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('online-notepad panel', () => {
  const editor = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-editor]')!;
  const empty = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-empty-state]')!;
  const status = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-save-status]')!;

  it('renders the note list and opens the newest note', async () => {
    const store = spyStore([
      note({ id: 'b', title: 'Older', updatedAt: 1_000 }),
      note({ id: 'a', title: 'Newest', content: 'body', updatedAt: 2_000 }),
    ]);
    const root = fixture();
    await mount(root, store);

    expect(listTitles(root)).toEqual(['Newest', 'Older']);
    expect(editor(root).hidden).toBe(false);
    expect(empty(root).hidden).toBe(true);
    expect(root.querySelector<HTMLInputElement>('[data-note-title]')!.value).toBe('Newest');
    expect(root.querySelector<HTMLTextAreaElement>('[data-note-content]')!.value).toBe('body');
    expect(status(root).textContent).toBe('Saved to this browser.');
  });

  it('shows the empty state when there are no notes', async () => {
    const root = fixture();
    await mount(root, spyStore());
    expect(editor(root).hidden).toBe(true);
    expect(empty(root).hidden).toBe(false);
    expect(listTitles(root)).toEqual([]);
  });

  it('creates a note with the New note button', async () => {
    const store = spyStore();
    const root = fixture();
    await mount(root, store);

    root.querySelector<HTMLButtonElement>('[data-new-note]')!.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(listTitles(root)).toEqual(['Untitled note']);
    expect(editor(root).hidden).toBe(false);
    expect((await store.list()).length).toBe(1);
  });

  it('autosaves typing after the debounce and reports the saved state', async () => {
    const store = spyStore([note({ id: 'n1', content: '' })]);
    const root = fixture();
    await mount(root, store);

    typeBody(root, 'typed here');
    expect(status(root).textContent).toBe('Saving…');
    expect((await store.get('n1'))?.content).toBe('');

    await vi.advanceTimersByTimeAsync(600);
    expect((await store.get('n1'))?.content).toBe('typed here');
    expect(status(root).textContent).toBe('Saved to this browser.');
  });

  it('flushes the last edit when the tab becomes hidden', async () => {
    const store = spyStore([note({ id: 'n1', content: '' })]);
    const root = fixture();
    await mount(root, store);

    typeBody(root, 'last keystroke');
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect((await store.get('n1'))?.content).toBe('last keystroke');
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('renames a note from the title field', async () => {
    const store = spyStore([note({ id: 'n1', title: 'Old' })]);
    const root = fixture();
    await mount(root, store);

    const title = root.querySelector<HTMLInputElement>('[data-note-title]')!;
    title.value = 'Renamed';
    title.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect((await store.get('n1'))?.title).toBe('Renamed');
    expect(listTitles(root)).toEqual(['Renamed']);
  });

  it('deletes a single note from the list', async () => {
    const store = spyStore([
      note({ id: 'a', title: 'A', updatedAt: 2_000 }),
      note({ id: 'b', title: 'B', updatedAt: 1_000 }),
    ]);
    const root = fixture();
    await mount(root, store);

    root
      .querySelector<HTMLButtonElement>('[data-note-list] [data-note-action="delete"]')!
      .click();
    await vi.advanceTimersByTimeAsync(0);

    expect(store.deletes).toEqual(['a']);
    expect(listTitles(root)).toEqual(['B']);
  });

  it('deletes every note and returns to the empty state', async () => {
    const store = spyStore([note({ id: 'a', title: 'A' })]);
    const root = fixture();
    await mount(root, store);

    root.querySelector<HTMLButtonElement>('[data-delete-all]')!.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(await store.list()).toEqual([]);
    expect(empty(root).hidden).toBe(false);
    expect(editor(root).hidden).toBe(true);
  });

  it('exports the open note as .txt and .md', async () => {
    const store = spyStore([note({ id: 'n1', title: 'My Note', content: 'hello' })]);
    const root = fixture();
    await mount(root, store);

    root.querySelector<HTMLButtonElement>('[data-export-txt]')!.click();
    expect(downloadTextMock).toHaveBeenLastCalledWith('hello', 'my-note.txt', 'text/plain');

    root.querySelector<HTMLButtonElement>('[data-export-md]')!.click();
    expect(downloadTextMock).toHaveBeenLastCalledWith(
      '# My Note\n\nhello',
      'my-note.md',
      'text/markdown',
    );
  });

  it('does not export when no note is open', async () => {
    const root = fixture();
    await mount(root, spyStore());
    root.querySelector<HTMLButtonElement>('[data-export-txt]')!.click();
    expect(downloadTextMock).not.toHaveBeenCalled();
  });

  it('keeps the export helper in step with the tool', () => {
    const out = buildExport(note({ title: 'My Note', content: 'hello' }), 'md');
    expect(out.filename).toBe('my-note.md');
  });
});

describe('formatTimestamp', () => {
  it('formats a real timestamp with the day and time', () => {
    const text = formatTimestamp(Date.UTC(2026, 9, 24, 9, 15));
    expect(text).toMatch(/\d/);
    expect(text.length).toBeGreaterThan(3);
  });

  it('renders a placeholder for an unusable value', () => {
    expect(formatTimestamp(Number.NaN)).toBe('—');
  });
});

