/**
 * The PDF fill-form panel.
 *
 * Loaded on demand by `pdf-fill-form.astro`; only pages that fill forms pay the
 * cost of this chunk.
 *
 * The flow is: choose a PDF → the panel reads it locally with pdf-lib and
 * enumerates the interactive AcroForm fields, offering an input per editable
 * field (a text box, a checkbox, a radio group or a dropdown/list) — then the
 * values are handed to the generic Web Worker, which flattens the form and
 * returns the filled PDF.
 *
 * The pure logic — classifying a field by kind, describing the editable fields
 * of a form, mapping a value onto a field and the fill + flatten step — lives
 * in `pdf-fill-form.core.ts`. This module re-exports it (so the panel and its
 * tests share one entry point) and owns the browser-only interaction.
 *
 * Nothing here talks to the network: the form is read and filled on this device
 * and the worker never posts the values anywhere.
 */
import { PDFDocument } from 'pdf-lib';
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '../workbench/shared';
import {
  describeFormFields,
  filledFilename,
  hasEditableFields,
  NO_FIELDS_HINT,
  NO_FIELDS_MESSAGE,
  type FillableField,
  type FormValues,
} from '@/tools/pdf/pdf-fill-form.core';

// The pure logic is re-exported so tests and other callers can import the whole
// fill-form API from one place.
export {
  applyFieldValue,
  classifyField,
  describeFormFields,
  fillAndFlatten,
  filledFilename,
  hasEditableFields,
  NO_FIELDS_HINT,
  NO_FIELDS_MESSAGE,
  parseValues,
  type FieldKind,
  type FillableField,
  type FormValues,
} from '@/tools/pdf/pdf-fill-form.core';

/** Mount the fill-form panel into a `[data-pdf-fill-form-panel]` element. */
export function mountPdfFillFormPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pdf-fill-form';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const fileList = root.querySelector<HTMLUListElement>('[data-file-list]');
  const formEl = root.querySelector<HTMLElement>('[data-fields]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-field-status]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]');
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]');

  // The astro panel always renders the drop zone, the fields container, the run
  // button and the error box, hence the non-null assertions above.

  let file: File | null = null;
  let fields: FillableField[] = [];
  let controller: AbortController | null = null;
  let runGeneration = 0;

  function renderFileList(): void {
    if (!fileList) return;
    fileList.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex shrink-0 items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
  }

  /** Render one input per editable field, keyed by the field's index. */
  function renderFields(): void {
    formEl.innerHTML = '';
    fields.forEach((field, index) => {
      const row = document.createElement('div');
      row.className = 'space-y-1';
      const label = document.createElement('label');
      label.className = 'block text-xs font-medium';
      label.textContent = field.name;
      const group = document.createElement('div');
      group.className = 'flex flex-wrap items-center gap-3';
      row.append(label, group);

      if (field.kind === 'text') {
        const control = document.createElement(field.multiline ? 'textarea' : 'input');
        control.className = field.multiline ? 'field w-full' : 'field';
        control.dataset.fieldIndex = String(index);
        if (field.multiline) (control as HTMLTextAreaElement).rows = 3;
        else (control as HTMLInputElement).type = 'text';
        group.appendChild(control);
      } else if (field.kind === 'checkbox') {
        const wrap = document.createElement('label');
        wrap.className = 'flex items-center gap-2 text-sm';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.fieldIndex = String(index);
        wrap.append(box, document.createTextNode('Checked'));
        group.appendChild(wrap);
      } else if (field.kind === 'radio') {
        field.options.forEach((option, optionIndex) => {
          const wrap = document.createElement('label');
          wrap.className = 'flex items-center gap-2 text-sm';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `pdf-field-${index}`;
          radio.id = `pdf-field-${index}-${optionIndex}`;
          radio.value = option;
          radio.dataset.fieldIndex = String(index);
          wrap.append(radio, document.createTextNode(option));
          group.appendChild(wrap);
        });
      } else {
        const select = document.createElement('select');
        select.className = 'field';
        select.dataset.fieldIndex = String(index);
        if (field.multiselect) select.multiple = true;
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '—';
        select.appendChild(blank);
        for (const option of field.options) {
          const entry = document.createElement('option');
          entry.value = option;
          entry.textContent = option;
          select.appendChild(entry);
        }
        group.appendChild(select);
      }
      formEl.appendChild(row);
    });
    if (statusEl) {
      statusEl.textContent = fields.length
        ? `${fields.length} field${fields.length === 1 ? '' : 's'} found.`
        : '';
    }
  }

  /** Collect the current value of every rendered field, keyed by field name. */
  function collectValues(): FormValues {
    const values: FormValues = {};
    fields.forEach((field, index) => {
      const selector = `[data-field-index="${index}"]`;
      if (field.kind === 'text') {
        const control = formEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
        if (control) values[field.name] = control.value;
      } else if (field.kind === 'checkbox') {
        const box = formEl.querySelector<HTMLInputElement>(selector);
        if (box) values[field.name] = box.checked;
      } else if (field.kind === 'radio') {
        const checked = formEl.querySelector<HTMLInputElement>(`${selector}:checked`);
        if (checked) values[field.name] = checked.value;
      } else {
        const select = formEl.querySelector<HTMLSelectElement>(selector);
        if (!select) return;
        if (field.multiselect) {
          values[field.name] = Array.from(select.selectedOptions).map(
            (option) => option.value,
          );
        } else if (select.value) {
          values[field.name] = select.value;
        }
      }
    });
    return values;
  }

  const dz = createDropZone(dropEl, {
    accept: 'application/pdf',
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) {
        const limit = validateFileSelection([next]);
        if (limit) {
          showError(errorBox, limit);
          return;
        }
      }
      file = next;
      renderFileList();
      void loadForm(file);
    },
  });

  /** Read the chosen PDF and enumerate its editable fields. */
  async function loadForm(next: File | null): Promise<void> {
    clearError(errorBox);
    fields = [];
    renderFields();
    if (resultWrap) resultWrap.hidden = true;
    if (runBtn) runBtn.disabled = true;
    if (!next) {
      if (statusEl) statusEl.textContent = '';
      return;
    }
    if (statusEl) statusEl.textContent = 'Reading the form…';
    try {
      const bytes = new Uint8Array(await next.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
      const form = doc.getForm();
      if (!hasEditableFields(form)) {
        if (statusEl) statusEl.textContent = '';
        showError(errorBox, NO_FIELDS_MESSAGE, NO_FIELDS_HINT);
        return;
      }
      fields = describeFormFields(form);
      renderFields();
      if (runBtn) runBtn.disabled = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (statusEl) statusEl.textContent = '';
      showError(
        errorBox,
        /password|encrypted/i.test(message)
          ? 'This PDF is password-protected — unlock it first.'
          : 'That PDF could not be read.',
        'The document may be damaged or encrypted.',
      );
    }
  }

  fileList?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    file = null;
    renderFileList();
    void loadForm(null);
  });

  function renderOutputs(result: FileRunResult): void {
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
    if (notesEl) {
      notesEl.innerHTML = '';
      for (const warning of result.warnings ?? []) {
        const li = document.createElement('li');
        li.style.color = 'rgb(var(--warning))';
        li.textContent = `⚠ ${warning}`;
        notesEl.appendChild(li);
      }
      for (const note of result.notes ?? []) {
        const li = document.createElement('li');
        li.className = 'text-[rgb(var(--text-muted))]';
        li.textContent = note;
        notesEl.appendChild(li);
      }
    }
  }

  async function run(): Promise<void> {
    if (!file) return;
    const generation = ++runGeneration;
    controller?.abort();
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    if (cancelBtn) cancelBtn.hidden = false;
    if (progressWrap) progressWrap.hidden = false;
    if (progressBar) progressBar.style.width = '0%';
    if (progressMsg) progressMsg.textContent = 'Working…';
    if (resultWrap) resultWrap.hidden = true;

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files: [file],
          options: {
            values: JSON.stringify(collectValues()),
            outputName: filledFilename(file.name),
          },
        },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressMsg) progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      if (progressBar) progressBar.style.width = '100%';
      if (progressMsg) progressMsg.textContent = 'Done';
      renderOutputs(result);
      if (resultWrap) resultWrap.hidden = false;
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') {
        if (progressMsg) progressMsg.textContent = 'Cancelled';
      } else {
        showError(errorBox, err.message || 'Filling the form failed.', err.hint);
      }
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = !file || !fields.length;
        if (cancelBtn) cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn?.addEventListener('click', () => controller?.abort());
  resetBtn?.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    file = null;
    fields = [];
    renderFileList();
    renderFields();
    void loadForm(null);
    if (progressWrap) progressWrap.hidden = true;
    if (resultWrap) resultWrap.hidden = true;
    clearError(errorBox);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      dz.destroy();
    },
    { once: true },
  );

  renderFileList();
}