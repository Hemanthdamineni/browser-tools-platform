/** DOM helpers shared by the text + file workbenches. */
import type { OptionValues, TextRunResult } from '@/lib/types';
import { escapeHtml } from '@/lib/format';

export function readOptions(root: ParentNode): OptionValues {
  const values: OptionValues = {};
  root.querySelectorAll<HTMLElement>('[data-opt-key]').forEach((el) => {
    const key = el.dataset.optKey!;
    const type = el.dataset.optType;
    if (type === 'boolean') {
      values[key] = (el as HTMLInputElement).checked;
    } else if (type === 'number') {
      values[key] = Number((el as HTMLInputElement).value);
    } else {
      values[key] = (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    }
  });
  return values;
}

export function applyShowWhen(root: ParentNode): void {
  const values = readOptions(root);
  root.querySelectorAll<HTMLElement>('[data-show-when]').forEach((wrap) => {
    try {
      const cond = JSON.parse(wrap.dataset.showWhen!) as { key: string; value: unknown };
      wrap.hidden = values[cond.key] !== cond.value;
    } catch {
      /* ignore malformed condition */
    }
  });
}

export function bindRangeOutputs(root: ParentNode): void {
  root.querySelectorAll<HTMLInputElement>('input[type="range"][data-opt-key]').forEach((input) => {
    const out = root.querySelector<HTMLOutputElement>(`[data-range-out="${input.dataset.optKey}"]`);
    if (out) input.addEventListener('input', () => (out.value = input.value));
  });
}

export function showError(box: HTMLElement, message: string, hint?: string): void {
  box.hidden = false;
  box.innerHTML = `<strong class="font-semibold">${escapeHtml(message)}</strong>${
    hint ? `<br><span class="opacity-80">${escapeHtml(hint)}</span>` : ''
  }`;
}

export function clearError(box: HTMLElement): void {
  box.hidden = true;
  box.textContent = '';
}

/**
 * Rasterise an image data URL to a PNG blob via an offscreen `<img>` + `<canvas>`.
 * SVG must be drawn this way — `createImageBitmap` rejects SVG blobs in Chromium.
 */
async function imageToPngBlob(url: string, scale = 2): Promise<Blob> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))),
      'image/png',
    ),
  );
}

/** Render a TextRunResult into `host`. Every branch is XSS-safe. */
export function renderTextResult(host: HTMLElement, result: TextRunResult): void {
  const kind = result.render ?? 'text';
  host.innerHTML = '';

  if (kind === 'image') {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col items-start gap-3';
    const img = document.createElement('img');
    img.src = result.output;
    img.alt = 'Generated output';
    img.className = 'max-h-[420px] w-auto rounded-lg border';
    img.style.backgroundColor = '#fff';
    wrap.appendChild(img);

    // Vector results get an on-the-spot PNG rasteriser; the toolbar Download
    // still hands over the original SVG.
    if (result.output.startsWith('data:image/svg+xml')) {
      const base = (result.filename ?? 'image').replace(/\.svg$/i, '');
      const png = document.createElement('button');
      png.type = 'button';
      png.className = 'btn btn-ghost !py-1 !px-2 text-xs';
      png.textContent = 'Download PNG';
      png.addEventListener('click', () => {
        void (async () => {
          const label = png.textContent;
          png.disabled = true;
          png.textContent = 'Rendering…';
          try {
            const blob = await imageToPngBlob(result.output);
            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = `${base}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(href), 1000);
          } catch {
            (window as unknown as { toast?: (m: string) => void }).toast?.('PNG export failed');
          } finally {
            png.disabled = false;
            png.textContent = label;
          }
        })();
      });
      wrap.appendChild(png);
    }

    host.appendChild(wrap);
    return;
  }

  if (kind === 'audio') {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-wrap items-center gap-3';
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = result.output; // set via property, never innerHTML (XSS-safe)
    audio.preload = 'metadata';
    wrap.appendChild(audio);
    if (result.filename) {
      const dl = document.createElement('a');
      dl.href = result.output;
      dl.download = result.filename;
      dl.className = 'btn btn-ghost !py-1 !px-2 text-xs';
      dl.textContent = `Download ${result.filename}`;
      wrap.appendChild(dl);
    }
    host.appendChild(wrap);
    return;
  }

  if (kind === 'colors') {
    let colors: string[] = [];
    try {
      colors = JSON.parse(result.output);
    } catch {
      colors = [];
    }
    const grid = document.createElement('div');
    grid.className = 'flex flex-wrap gap-2';
    colors.forEach((c) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.title = `Copy ${c}`;
      sw.className = 'h-16 w-24 rounded-lg border text-[11px] font-mono';
      sw.style.backgroundColor = c;
      sw.style.color = readableOn(c);
      sw.textContent = c;
      sw.addEventListener('click', () => navigator.clipboard?.writeText(c));
      grid.appendChild(sw);
    });
    host.appendChild(grid);
    return;
  }

  if (kind === 'table') {
    let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] };
    try {
      data = JSON.parse(result.output);
    } catch {
      /* fall back to text */
    }
    const wrap = document.createElement('div');
    wrap.className = 'overflow-x-auto rounded-lg border';
    const table = document.createElement('table');
    table.className = 'w-full text-left text-sm';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${data.headers
      .map(
        (h) =>
          `<th scope="col" class="border-b bg-[rgb(var(--bg-subtle))] px-3 py-2 text-left font-semibold text-[rgb(var(--text))]">${escapeHtml(h)}</th>`,
      )
      .join('')}</tr>`;
    const tbody = document.createElement('tbody');
    tbody.innerHTML = data.rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td class="border-b px-3 py-1.5 align-top font-mono text-xs text-[rgb(var(--text))]">${escapeHtml(String(c))}</td>`).join('')}</tr>`,
      )
      .join('');
    table.append(thead, tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);
    return;
  }

  if (kind === 'diff') {
    const pre = document.createElement('pre');
    pre.className = 'overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed';
    pre.innerHTML = result.output
      .split('\n')
      .map((line) => {
        const safe = escapeHtml(line);
        if (line.startsWith('+') && !line.startsWith('+++'))
          return `<span style="color: rgb(var(--accent))">${safe}</span>`;
        if (line.startsWith('-') && !line.startsWith('---'))
          return `<span style="color: rgb(var(--danger))">${safe}</span>`;
        if (line.startsWith('@@')) return `<span class="text-[rgb(var(--text-faint))]">${safe}</span>`;
        return safe;
      })
      .join('\n');
    host.appendChild(pre);
    return;
  }

  // text / code / html-escaped → read-only textarea for easy select+copy
  const ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.className = 'field';
  ta.setAttribute('aria-label', 'Result output');
  ta.rows = Math.min(20, Math.max(4, result.output.split('\n').length + 1));
  ta.value = result.output;
  host.appendChild(ta);
  if (kind === 'code' && result.language) {
    const tag = document.createElement('span');
    tag.className = 'chip mt-2';
    tag.textContent = result.language;
    host.appendChild(tag);
  }
}

function readableOn(bg: string): string {
  // crude luminance check for swatch label colour
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(bg.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return '#000';
  const lin = (hex: string) => {
    const c = parseInt(hex, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
  return L > 0.4 ? '#000' : '#fff';
}
