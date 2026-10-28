/**
 * The video-frames panel.
 *
 * Handles video file input, frame extraction via WebCodecs, preview grid,
 * and download as individual frames or ZIP archive.
 */
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { downloadBlob, downloadZip } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { extractFrames, type ExtractedFrame, type FrameExtractionResult } from '@/tools/video/video-frames.core';
import { clearError, showError } from '../workbench/shared';
import { zip, type Zippable } from 'fflate';

export function mountVideoFramesWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'video-frames';

  // Elements
  const fileInput = root.querySelector<HTMLInputElement>('[data-vf-file]')!;
  const modeSelect = root.querySelector<HTMLSelectElement>('[data-vf-mode]')!;
  const intervalInput = root.querySelector<HTMLInputElement>('[data-vf-interval]')!;
  const countInput = root.querySelector<HTMLInputElement>('[data-vf-count]')!;
  const widthInput = root.querySelector<HTMLInputElement>('[data-vf-width]')!;
  const extractBtn = root.querySelector<HTMLButtonElement>('[data-vf-extract]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-vf-status]')!;
  const previewGrid = root.querySelector<HTMLElement>('[data-vf-preview-grid]')!;
  const downloadWrap = root.querySelector<HTMLElement>('[data-vf-download-wrap]')!;
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-vf-download]')!;

  if (!fileInput || !modeSelect || !intervalInput || !countInput || !widthInput ||
      !extractBtn || !statusEl || !previewGrid || !downloadWrap || !downloadBtn) {
    return;
  }

  let selectedFile: File | null = null;
  let extractedFrames: ExtractedFrame[] = [];
  let objectUrls: string[] = [];
  let busy = false;
  let abortController: AbortController | null = null;

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function resetState(): void {
    extractedFrames = [];
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    previewGrid.innerHTML = '';
    previewGrid.hidden = true;
    downloadWrap.hidden = true;
  }

  function updateExtractButtonState(): void {
    extractBtn.disabled = busy || !selectedFile;
  }

  function renderPreview(frames: ExtractedFrame[], result: FrameExtractionResult): void {
    previewGrid.innerHTML = '';
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];

    for (const frame of frames) {
      const url = URL.createObjectURL(frame.blob);
      objectUrls.push(url);

      const item = document.createElement('div');
      item.className = 'relative group';

      const img = document.createElement('img');
      img.src = url;
      img.alt = `Frame at ${frame.timestamp.toFixed(2)}s`;
      img.className = 'w-full aspect-video object-cover rounded-md border';
      img.loading = 'lazy';

      const info = document.createElement('div');
      info.className = 'absolute bottom-0 left-0 right-0 p-2 text-xs bg-gradient-to-t from-black/80 to-transparent text-white';
      info.textContent = `${frame.timestamp.toFixed(2)}s • ${formatBytes(frame.blob.size)}`;

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'absolute top-2 right-2 p-1.5 rounded bg-white/90 text-black opacity-0 group-hover:opacity-100 transition-opacity';
      downloadBtn.innerHTML = '⬇';
      downloadBtn.title = 'Download this frame';
      downloadBtn.onclick = () => downloadBlob(frame.blob, frame.filename);

      item.append(img, info, downloadBtn);
      previewGrid.appendChild(item);
    }

    previewGrid.hidden = false;
    downloadWrap.hidden = false;
  }

  async function runExtraction(): Promise<void> {
    if (!selectedFile || busy) return;

    busy = true;
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting…';
    clearError(root);

    abortController = new AbortController();

    try {
      const options = {
        mode: modeSelect.value,
        interval: Number(intervalInput.value),
        count: Number(countInput.value),
        width: Number(widthInput.value),
      };

      const result = await extractFrames(
        selectedFile,
        options,
        {
          signal: abortController.signal,
          onProgress: (fraction, message) => {
            if (abortController?.signal.aborted) return;
            announce(`${message} (${Math.round(fraction * 100)}%)`);
          },
        }
      );

      extractedFrames = result.frames;

      announce(`Extracted ${result.frames.length} frame${result.frames.length > 1 ? 's' : ''} from ${selectedFile.name}`);
      renderPreview(result.frames, result);

      // Set up download all as ZIP
      downloadBtn.onclick = async () => {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Creating ZIP…';

        try {
          const entries: Record<string, Uint8Array> = {};

          for (const frame of result.frames) {
            const arrayBuffer = await frame.blob.arrayBuffer();
            entries[frame.filename] = new Uint8Array(arrayBuffer);
          }

          const zipData = await new Promise<Uint8Array>((resolve, reject) => {
            zip(entries as any, (err, data) => {
              if (err) reject(err);
              else resolve(data!);
            });
          });

          const zipBlob = new Blob([zipData], { type: 'application/zip' });
          const zipName = (selectedFile?.name ?? 'video').replace(/\.[^.]+$/, '') + '-frames.zip';
          downloadBlob(zipBlob, zipName);
          announce(`Downloaded ${result.frames.length} frames as ZIP`);
        } catch (err) {
          console.error('ZIP creation failed:', err);
          showError(root, 'Failed to create ZIP', 'Try downloading frames individually.');
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.textContent = 'Download all as ZIP';
        }
      };

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        announce('Extraction cancelled.');
      } else if (err instanceof ToolError) {
        showError(root, err.message, err.hint);
        announce('Extraction failed.');
      } else {
        console.error('Extraction error:', err);
        showError(root, 'Frame extraction failed', 'The video may be corrupted or use an unsupported codec.');
        announce('Extraction failed.');
      }
    } finally {
      busy = false;
      abortController = null;
      updateExtractButtonState();
      extractBtn.textContent = 'Extract Frames';
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0] ?? null;
    if (file) {
      if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|m4v|mov|webm|mkv|ogv|ts)$/i)) {
        showError(root, 'Not a video file', 'Please select a valid video file.');
        fileInput.value = '';
        selectedFile = null;
        return;
      }
      selectedFile = file;
      resetState();
      announce(`Ready to extract frames from ${file.name} (${formatBytes(file.size)})`);
    } else {
      selectedFile = null;
      resetState();
      announce('Select a video file');
    }
    updateExtractButtonState();
  });

  extractBtn.addEventListener('click', runExtraction);

  // Keyboard support for cancel
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && busy && abortController) {
      abortController.abort();
    }
  });

  // Cleanup
  const cleanup = (): void => {
    if (abortController) {
      abortController.abort();
    }
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initial state
  updateExtractButtonState();
}