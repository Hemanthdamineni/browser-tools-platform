/**
 * The PGP panel's DOM wiring.
 *
 * The pure orchestration lives in `./pgp-tool-panel` (which the tool's `run()`
 * also imports, so it never sees DOM code). This module is only loaded by the
 * panel's `<script>` and binds the sections, fields, drop zones and buttons to
 * `runToolById`. `pgp-tool-panel.client.test.ts` exercises it with the worker
 * client mocked.
 */
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { applyShowWhen, clearError, readOptions, renderTextResult, showError } from '../workbench/shared';
import {
  buildPgpPayload,
  missingField,
  passphraseStrength,
  saveKeys,
  visibleSection,
  STORAGE_PRIVATE_KEY,
  STORAGE_PUBLIC_KEY,
  type PgpMode,
  type PgpSection,
  type PgpPanelValues,
} from './pgp-tool-panel';

const MODES: PgpMode[] = ['generate', 'encrypt', 'decrypt', 'sign', 'verify', 'import'];

const SECTION_ATTR: Record<PgpSection, string> = {
  gen: 'data-gen',
  enc: 'data-enc',
  dec: 'data-dec',
  sig: 'data-sig',
  ver: 'data-ver',
  imp: 'data-imp',
};

/** Per-section file slot, used to attach a chosen file to encrypt/decrypt. */
const FILE_SLOT: Partial<Record<PgpSection, 'data-drop-enc' | 'data-drop-dec'>> = {
  enc: 'data-drop-enc',
  dec: 'data-drop-dec',
};

/** The visible panel state read straight off the DOM. */
interface DomValues {
  publicKey: string;
  privateKey: string;
  passphrase: string;
  signature: string;
  text: string;
  file: File | null;
}

/** Selector for each field, per section. `key` is public for enc/ver. */
const SECTION_FIELDS: Record<
  PgpSection,
  { text?: string; key?: string; keyIsPublic?: boolean; passphrase?: string; signature?: string }
> = {
  gen: { passphrase: '[data-gen-pass]' },
  enc: { text: '[data-enc-msg]', key: '[data-enc-key]', keyIsPublic: true },
  dec: { text: '[data-dec-msg]', key: '[data-dec-key]', passphrase: '[data-dec-pass]' },
  sig: { text: '[data-sig-msg]', key: '[data-sig-key]', passphrase: '[data-sig-pass]' },
  ver: {
    text: '[data-ver-msg]',
    key: '[data-ver-key]',
    keyIsPublic: true,
    signature: '[data-ver-sig]',
  },
  imp: { key: '[data-imp-key]', passphrase: '[data-imp-pass]' },
};

/** Read the current values from the active section's fields. */
function readDom(root: HTMLElement, section: PgpSection, file: File | null): DomValues {
  const read = (selector?: string): string =>
    selector
      ? (root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? '')
      : '';
  const f = SECTION_FIELDS[section];
  const key = read(f.key);
  return {
    publicKey: f.keyIsPublic ? key : '',
    privateKey: f.keyIsPublic ? '' : key,
    passphrase: read(f.passphrase),
    signature: read(f.signature),
    text: read(f.text),
    file,
  };
}

/** The mode currently selected in the options form, defaulting to `generate`. */
export function currentMode(root: HTMLElement): PgpMode {
  const raw = String(readOptions(root).mode ?? 'generate');
  return (MODES as string[]).includes(raw) ? (raw as PgpMode) : 'generate';
}

/** Mount the PGP panel into a `[data-pgp-panel]` element. */
export function mountPgpPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pgp-tool';
  const optionsRoot = root.querySelector<HTMLElement>('[data-options]') ?? root;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const outputHost = root.querySelector<HTMLElement>('[data-output]');
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]');
  const statsHost = root.querySelector<HTMLElement>('[data-stats]');
  const notesHost = root.querySelector<HTMLUListElement>('[data-notes]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]');
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]');
  const genRun = root.querySelector<HTMLButtonElement>('[data-gen-run]');
  const encRun = root.querySelector<HTMLButtonElement>('[data-enc-run]');
  const decRun = root.querySelector<HTMLButtonElement>('[data-dec-run]');
  const sigRun = root.querySelector<HTMLButtonElement>('[data-sig-run]');
  const verRun = root.querySelector<HTMLButtonElement>('[data-ver-run]');
  const impRun = root.querySelector<HTMLButtonElement>('[data-imp-run]');
  const genHint = root.querySelector<HTMLElement>('[data-gen-hint]');
  const genSave = root.querySelector<HTMLInputElement>('[data-gen-save]');
  const genPass = root.querySelector<HTMLInputElement>('[data-gen-pass]');
  const loadPub = root.querySelectorAll<HTMLButtonElement>('[data-load-pub]');
  const loadPriv = root.querySelectorAll<HTMLButtonElement>('[data-load-priv]');

  if (!optionsRoot || !errorBox || !genRun) return;

  let file: File | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  let lastText = '';

  /** Live passphrase hint for the generate section. */
  function updateGenHint(): void {
    if (!genHint) return;
    const hint = passphraseStrength(genPass?.value ?? '');
    const text = hint.score === 0 ? '' : `${hint.label} — ${hint.suggestion}`;
    genHint.textContent = text;
  }

  /** Show only the section for the current mode. */
  function syncSections(): void {
    const section = visibleSection(currentMode(optionsRoot));
    for (const [sectionKey, attr] of Object.entries(SECTION_ATTR) as [PgpSection, string][]) {
      const node = root.querySelector<HTMLElement>(`[${attr}]`);
      if (node) node.hidden = sectionKey !== section;
    }
    file = null;
    renderChosenFile();
    updateGenHint();
  }

  /** Show the name of the chosen file under the active drop zone. */
  function renderChosenFile(): void {
    const name = root.querySelector<HTMLElement>('[data-file-name]');
    if (name) name.textContent = file ? `📎 ${file.name}` : '';
  }

  /** Render a `FileRunResult` into the shared result area. */
  function renderResult(result: FileRunResult): void {
    lastText = result.report?.output ?? '';

    if (outputHost) {
      outputHost.innerHTML = '';
      if (result.report) {
        renderTextResult(outputHost, result.report);
      }
    }

    if (outputsEl) {
      outputsEl.innerHTML = '';
      for (const output of result.outputs) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
        const name = document.createElement('span');
        name.className = 'truncate text-sm';
        name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'btn btn-subtle btn-sm shrink-0';
        download.textContent = 'Save';
        download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
        li.append(name, download);
        outputsEl.appendChild(li);
      }
    }

    if (statsHost) {
      statsHost.innerHTML = '';
      for (const [key, value] of Object.entries(result.stats ?? {})) {
        const span = document.createElement('span');
        span.innerHTML = `<span class="font-medium text-[rgb(var(--text))]">${escapeHtml(key)}:</span> ${escapeHtml(String(value))}`;
        statsHost.appendChild(span);
      }
    }

    if (notesHost) {
      notesHost.innerHTML = '';
      for (const warning of result.warnings ?? []) {
        const li = document.createElement('li');
        li.style.color = 'rgb(var(--warning))';
        li.textContent = `⚠ ${warning}`;
        notesHost.appendChild(li);
      }
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesHost.appendChild(li);
      }
    }

    if (copyBtn) copyBtn.hidden = !lastText;
  }

  /** Run the current mode against the worker. */
  async function run(mode: PgpMode, values: PgpPanelValues): Promise<void> {
    const generation = ++runGeneration;
    controller?.abort();
    controller = new AbortController();
    clearError(errorBox);
    disableAllButtons(true);
    setProgress(true, 'Working…');
    if (cancelBtn) cancelBtn.hidden = false;
    if (resultWrap) resultWrap.hidden = true;

    const payload = buildPgpPayload(mode, values);
    try {
      const result = await runToolById<FileRunResult>(toolId, payload, {
        signal: controller.signal,
        onProgress: (fraction, message) => {
          if (generation !== runGeneration) return;
          const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressMsg) progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
        },
      });
      if (generation !== runGeneration) return;
      if (progressBar) progressBar.style.width = '100%';
      if (progressMsg) progressMsg.textContent = 'Done';
      renderResult(result);
      if (resultWrap) resultWrap.hidden = false;
      if (mode === 'generate' && genSave?.checked && result.report) {
        try {
          const parsed = JSON.parse(result.report.output) as {
            privateKey?: string;
            publicKey?: string;
          };
          if (parsed.privateKey && parsed.publicKey) {
            saveKeys(localStorage, parsed.publicKey, parsed.privateKey);
            if (notesHost) {
              const li = document.createElement('li');
              li.className = 'text-[rgb(var(--text-muted))]';
              li.textContent = 'Saved this key pair to this browser (localStorage).';
              notesHost.appendChild(li);
            }
          }
        } catch {
          /* the report did not carry keys; nothing to save */
        }
      }
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') {
        if (progressMsg) progressMsg.textContent = 'Cancelled';
      } else {
        showError(errorBox, err.message || 'Something went wrong.', err.hint);
      }
    } finally {
      if (generation === runGeneration) {
        disableAllButtons(false);
        setProgress(false, '');
        if (cancelBtn) cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  /** Enable/disable every action button while a run is in flight. */
  function disableAllButtons(disabled: boolean): void {
    for (const btn of [genRun, encRun, decRun, sigRun, verRun, impRun]) {
      if (btn) btn.disabled = disabled;
    }
  }

  /** Show or hide the progress bar and message. */
  function setProgress(visible: boolean, message: string): void {
    if (progressWrap) progressWrap.hidden = !visible;
    if (progressBar) progressBar.style.width = '0%';
    if (progressMsg) progressMsg.textContent = message;
  }

  /** Gather the panel's fields and run a mode, after checking required inputs. */
  function start(mode: PgpMode): void {
    const section = visibleSection(mode);
    const dom = readDom(root, section, file);
    const values: PgpPanelValues = { ...dom, options: readOptions(optionsRoot) };
    const missing = missingField(mode, values);
    if (missing) {
      showError(errorBox, missing);
      return;
    }
    void run(mode, values);
  }

  /** Fill the key fields of the matching sections from opt-in local storage. */
  function loadSaved(which: 'public' | 'private'): void {
    let value: string | null = null;
    try {
      value = localStorage.getItem(
        which === 'public' ? STORAGE_PUBLIC_KEY : STORAGE_PRIVATE_KEY,
      );
    } catch {
      showError(errorBox, 'Could not read from this browser\u2019s storage.');
      return;
    }
    if (!value) {
      showError(
        errorBox,
        `No ${which} key saved in this browser.`,
        'Paste a key, or generate one and tick the save box.',
      );
      return;
    }
    const selector =
      which === 'public'
        ? '[data-enc-key], [data-ver-key]'
        : '[data-dec-key], [data-sig-key], [data-imp-key]';
    root.querySelectorAll<HTMLTextAreaElement>(selector).forEach((el) => (el.value = value));
    clearError(errorBox);
  }

  // --- wiring -------------------------------------------------------------
  genRun?.addEventListener('click', () => start('generate'));
  encRun?.addEventListener('click', () => start('encrypt'));
  decRun?.addEventListener('click', () => start('decrypt'));
  sigRun?.addEventListener('click', () => start('sign'));
  verRun?.addEventListener('click', () => start('verify'));
  impRun?.addEventListener('click', () => start('import'));

  genPass?.addEventListener('input', updateGenHint);
  loadPub.forEach((btn) => btn.addEventListener('click', () => loadSaved('public')));
  loadPriv.forEach((btn) => btn.addEventListener('click', () => loadSaved('private')));

  cancelBtn?.addEventListener('click', () => controller?.abort());
  copyBtn?.addEventListener('click', () => {
    if (lastText) void navigator.clipboard?.writeText(lastText);
  });
  resetBtn?.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    root
      .querySelectorAll<HTMLTextAreaElement>('textarea[data-enc-key], textarea[data-dec-key], textarea[data-sig-key], textarea[data-ver-key], textarea[data-imp-key], textarea[data-enc-msg], textarea[data-dec-msg], textarea[data-sig-msg], textarea[data-ver-msg], textarea[data-ver-sig]')
      .forEach((el) => (el.value = ''));
    root
      .querySelectorAll<HTMLInputElement>('input[type="password"]')
      .forEach((el) => (el.value = ''));
    file = null;
    renderChosenFile();
    clearError(errorBox);
    if (resultWrap) resultWrap.hidden = true;
    if (progressWrap) progressWrap.hidden = true;
  });

  // File drop zones, one per file-accepting section.
  const zones: { destroy: () => void }[] = [];
  for (const attr of ['data-drop-enc', 'data-drop-dec']) {
    const zone = root.querySelector<HTMLElement>(`[${attr}]`);
    if (!zone) continue;
    zones.push(
      createDropZone(zone, {
        multiple: false,
        onFiles: (files) => {
          file = files[0] ?? null;
          renderChosenFile();
          clearError(errorBox);
        },
      }),
    );
  }

  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    syncSections();
  });
  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    syncSections();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      try {
        const payload = JSON.parse(btn.dataset.examplePayload ?? '{}') as {
          input?: string;
          options?: Record<string, unknown>;
        };
        for (const [key, value] of Object.entries(payload.options ?? {})) {
          const el = optionsRoot.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[data-opt-key="${key}"]`,
          );
          if (!el) continue;
          if ((el as HTMLInputElement).type === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
          } else {
            el.value = String(value);
          }
        }
        applyShowWhen(optionsRoot);
        syncSections();
      } catch {
        /* malformed example */
      }
    });
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      for (const zone of zones) zone.destroy();
    },
    { once: true },
  );

  applyShowWhen(optionsRoot);
  syncSections();
}
