/**
 * Webcam Test panel. Loaded on demand by `webcam-test.astro`, so no camera code
 * ships to pages that don't test a camera.
 *
 * Everything here is local: the preview is a live `<video>` fed by
 * `getUserMedia`, the frame rate is counted from the frames the browser
 * actually presents, and the snapshot is drawn to a `<canvas>` in this tab.
 * Nothing is recorded, stored or transmitted.
 *
 * The measurements are handed to this tool's own `run()` (through
 * `runToolById`) so the report logic stays in the tool module and stays
 * unit-testable.
 */
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { clearError, renderTextResult, showError } from '../workbench/shared';
import {
  FRAME_WINDOW_MS,
  assertHasDevices,
  describeCameraError,
  formatAspectRatio,
  formatFps,
  formatResolution,
  fpsFromTimestamps,
  trimFrameWindow,
  type CameraDevice,
  type CaptureProbe,
  type FpsSource,
} from '@/tools/device/webcam-test.core';

/** How often the live readout is repainted. Frames arrive far faster than this. */
const READOUT_MS = 250;

const READOUT_KEYS = ['resolution', 'aspect', 'fps', 'track-fps', 'frames'] as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mount the webcam test UI into a `[data-webcam-test-panel]` element. */
export function mountWebcamTestPanel(panel: HTMLElement): void {
  // Astro always renders these; the guard keeps a markup change from crashing.
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-webcam-start]');
  const stopBtn = panel.querySelector<HTMLButtonElement>('[data-webcam-stop]');
  const snapshotBtn = panel.querySelector<HTMLButtonElement>('[data-webcam-snapshot]');
  const video = panel.querySelector<HTMLVideoElement>('[data-webcam-video]');
  const stage = panel.querySelector<HTMLElement>('[data-webcam-stage]');
  const status = panel.querySelector<HTMLElement>('[data-webcam-status]');
  const errorBox = panel.querySelector<HTMLElement>('[data-webcam-error]');
  const readout = panel.querySelector<HTMLElement>('[data-webcam-readout]');
  const reportHost = panel.querySelector<HTMLElement>('[data-webcam-report]');
  const outputsHost = panel.querySelector<HTMLElement>('[data-webcam-outputs]');
  const notesHost = panel.querySelector<HTMLElement>('[data-webcam-notes]');
  const deviceSelect = panel.querySelector<HTMLSelectElement>('[data-webcam-device]');
  const deviceWrap = panel.querySelector<HTMLElement>('[data-webcam-device-wrap]');
  if (
    !startBtn ||
    !stopBtn ||
    !snapshotBtn ||
    !video ||
    !stage ||
    !status ||
    !errorBox ||
    !readout ||
    !reportHost ||
    !outputsHost ||
    !notesHost
  ) {
    return;
  }

  const toolId = panel.dataset.toolId ?? 'webcam-test';

  let stream: MediaStream | null = null;
  let live = false;
  let granted = false;
  let deviceId = '';
  let devices: CameraDevice[] = [];
  let frameTimes: number[] = [];
  let frameHandle: number | null = null;
  let fpsSource: FpsSource = 'video-frame';
  let lastReadoutAt = 0;

  const announce = (message: string): void => {
    status.textContent = message;
  };

  function setValue(key: string, value: string): void {
    const el = readout!.querySelector<HTMLElement>(`[data-webcam-value="${key}"]`);
    if (el) el.textContent = value;
  }

  function resetReadout(): void {
    for (const key of READOUT_KEYS) setValue(key, '—');
  }

  function trackSettings(): MediaTrackSettings | null {
    return stream?.getVideoTracks()[0]?.getSettings?.() ?? null;
  }

  /* ---------------------------------------------------------------------- */
  /*  Frame-rate measurement                                                */
  /* ---------------------------------------------------------------------- */

  function scheduleFrame(): void {
    frameHandle =
      fpsSource === 'video-frame'
        ? video!.requestVideoFrameCallback(onFrame)
        : window.requestAnimationFrame(onFrame);
  }

  function onFrame(now: number): void {
    frameTimes.push(now);
    const trimmed = trimFrameWindow(frameTimes, now, FRAME_WINDOW_MS);
    if (trimmed !== frameTimes) frameTimes = trimmed;
    if (now - lastReadoutAt >= READOUT_MS) {
      lastReadoutAt = now;
      updateReadout();
    }
    scheduleFrame();
  }

  function startMeter(): void {
    stopMeter();
    frameTimes = [];
    lastReadoutAt = 0;
    // `requestVideoFrameCallback` counts frames the compositor actually showed —
    // the honest number. Without it, fall back to the display refresh loop.
    fpsSource = typeof video!.requestVideoFrameCallback === 'function' ? 'video-frame' : 'raf';
    scheduleFrame();
  }

  function stopMeter(): void {
    if (frameHandle === null) return;
    if (fpsSource === 'video-frame') video!.cancelVideoFrameCallback(frameHandle);
    else window.cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }

  function updateReadout(): void {
    const settings = trackSettings();
    const width = video!.videoWidth || settings?.width || null;
    const height = video!.videoHeight || settings?.height || null;
    setValue('resolution', formatResolution(width, height));
    setValue('aspect', formatAspectRatio(width, height) ?? 'unknown');
    setValue('fps', formatFps(fpsFromTimestamps(frameTimes)));
    setValue('track-fps', formatFps(settings?.frameRate ?? null));
    setValue('frames', String(frameTimes.length));
  }

  /* ---------------------------------------------------------------------- */
  /*  Devices                                                              */
  /* ---------------------------------------------------------------------- */

  function fillDevicePicker(): void {
    if (!deviceSelect || !deviceWrap) return;
    if (!devices.length) {
      deviceWrap.hidden = true;
      return;
    }
    deviceSelect.replaceChildren();
    devices.forEach((device, index) => {
      const option = element('option', undefined, device.label || `Camera ${index + 1}`);
      option.value = device.deviceId;
      option.selected = device.active;
      deviceSelect.appendChild(option);
    });
    deviceWrap.hidden = false;
  }

  /** Re-read the browser's video inputs. Labels only appear after permission. */
  async function refreshDevices(): Promise<CameraDevice[]> {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return [];
    let listed: MediaDeviceInfo[];
    try {
      listed = await media.enumerateDevices();
    } catch {
      return devices;
    }
    devices = listed
      .filter((entry) => entry.kind === 'videoinput')
      .map((camera, index) => ({
        deviceId: camera.deviceId,
        label: camera.label || `Camera ${index + 1}`,
        active: camera.deviceId === deviceId,
      }));
    fillDevicePicker();
    return devices;
  }

  /* ---------------------------------------------------------------------- */
  /*  Capture pipeline                                                      */
  /* ---------------------------------------------------------------------- */

  function releaseStream(): void {
    stopMeter();
    live = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video!.srcObject = null;
  }

  function stopCamera(message = 'Camera off.'): void {
    releaseStream();
    frameTimes = [];
    stage!.hidden = true;
    readout!.hidden = true;
    startBtn!.hidden = false;
    startBtn!.disabled = false;
    stopBtn!.hidden = true;
    snapshotBtn!.hidden = true;
    snapshotBtn!.disabled = true;
    resetReadout();
    announce(message);
  }

  function constraints(): MediaStreamConstraints {
    return deviceId
      ? { video: { deviceId: { exact: deviceId } }, audio: false }
      : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
  }

  async function start(): Promise<void> {
    if (live) return;
    clearError(errorBox!);
    startBtn!.disabled = true;
    announce('Requesting camera permission…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new ToolError(
          'This browser does not expose a camera API.',
          'Camera access needs a recent Chrome, Edge, Firefox or Safari.',
        );
      }
      // Once access has been granted the device list is complete, so an empty
      // one means the camera really is gone (unplugged, disabled, removed).
      if (granted) assertHasDevices(await refreshDevices());

      const media = await navigator.mediaDevices.getUserMedia(constraints());
      stream = media;
      const track = media.getVideoTracks()[0];
      const trackDeviceId = track?.getSettings?.().deviceId;
      if (trackDeviceId) deviceId = trackDeviceId;
      video!.srcObject = media;
      await video!.play().catch(() => undefined);

      live = true;
      granted = true;
      stage!.hidden = false;
      readout!.hidden = false;
      startBtn!.hidden = true;
      stopBtn!.hidden = false;
      snapshotBtn!.hidden = false;
      snapshotBtn!.disabled = true;
      announce('Camera on — measuring the live stream.');
      resetReadout();
      startMeter();

      await refreshDevices();
      if (!devices.length && track) {
        devices = [{ deviceId, label: track.label || 'Camera', active: true }];
      }
      fillDevicePicker();

      const waitForFirstFrame = (): void => {
        if (!live) return;
        if (video!.videoWidth) {
          snapshotBtn!.disabled = false;
          updateReadout();
          return;
        }
        window.requestAnimationFrame(waitForFirstFrame);
      };
      waitForFirstFrame();
    } catch (err) {
      stopCamera('Camera could not start.');
      const toolError = err instanceof ToolError ? err : describeCameraError(err);
      showError(errorBox!, toolError.message, toolError.hint);
    }
  }

  function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
    const { promise, resolve, reject } = Promise.withResolvers<Blob>();
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else {
        reject(
          new ToolError(
            'The frame could not be encoded as a PNG.',
            'Try a different browser or a smaller camera resolution.',
          ),
        );
      }
    }, 'image/png');
    return promise;
  }

  /** Everything the panel measured, in the shape the tool's `run()` expects. */
  function buildProbe(): CaptureProbe {
    const settings = trackSettings();
    const frames = frameTimes.length;
    return {
      deviceId,
      deviceLabel: stream?.getVideoTracks()[0]?.label ?? '',
      settings: {
        width: video!.videoWidth || settings?.width || null,
        height: video!.videoHeight || settings?.height || null,
        frameRate: settings?.frameRate ?? null,
        aspectRatio: settings?.aspectRatio ?? null,
        facingMode: settings?.facingMode ?? null,
      },
      fps: fpsFromTimestamps(frameTimes),
      frames,
      sampleMs: frames >= 2 ? frameTimes[frames - 1]! - frameTimes[0]! : 0,
      fpsSource,
      devices: devices.length ? devices : null,
    };
  }

  function renderResult(result: FileRunResult): void {
    if (result.report) {
      renderTextResult(reportHost!, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
      reportHost!.hidden = false;
    } else {
      reportHost!.hidden = true;
      reportHost!.replaceChildren();
    }

    outputsHost!.replaceChildren();
    for (const output of result.outputs) {
      const row = element('li', 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2');
      row.appendChild(
        element('span', 'truncate text-sm', `${output.filename} · ${formatBytes(output.blob.size)}`),
      );
      const save = element('button', 'btn btn-subtle btn-sm shrink-0', 'Save');
      save.type = 'button';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      row.appendChild(save);
      outputsHost!.appendChild(row);
    }

    notesHost!.replaceChildren();
    for (const warning of result.warnings ?? []) {
      const item = element('li', undefined, `⚠ ${warning}`);
      item.style.color = 'rgb(var(--warning))';
      notesHost!.appendChild(item);
    }
    for (const note of result.notes ?? []) {
      notesHost!.appendChild(element('li', 'text-[rgb(var(--text-muted))]', note));
    }
  }

  async function takeSnapshot(): Promise<void> {
    if (!live || !video!.videoWidth || !video!.videoHeight) {
      announce('Wait for the first frame, then take the snapshot.');
      return;
    }
    clearError(errorBox!);
    snapshotBtn!.disabled = true;
    announce('Capturing the current frame…');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video!.videoWidth;
      canvas.height = video!.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new ToolError(
          'This browser could not create a drawing canvas.',
          'Try a recent Chrome, Edge, Firefox or Safari.',
        );
      }
      context.drawImage(video!, 0, 0, canvas.width, canvas.height);
      const blob = await toPng(canvas);
      const file = new File([blob], 'webcam-snapshot.png', { type: 'image/png' });
      const result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: { capture: JSON.stringify(buildProbe()) },
      });
      renderResult(result);
      announce('Snapshot captured — the report and the PNG are below.');
    } catch (err) {
      const failure = err as Error & { hint?: string };
      showError(errorBox!, failure.message || 'The snapshot could not be captured.', failure.hint);
      announce('The snapshot could not be captured.');
    } finally {
      snapshotBtn!.disabled = !live || !video!.videoWidth;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* ---------------------------------------------------------------------- */

  startBtn.addEventListener('click', () => void start());
  stopBtn.addEventListener('click', () => stopCamera());
  snapshotBtn.addEventListener('click', () => void takeSnapshot());
  deviceSelect?.addEventListener('change', () => {
    if (!deviceSelect) return;
    deviceId = deviceSelect.value;
    stopCamera('Switching camera…');
    void start();
  });

  window.addEventListener('pagehide', () => stopCamera('Camera off.'));
  window.addEventListener('beforeunload', () => releaseStream());

  void refreshDevices().then(() => {
    if (devices.length) announce('Camera found — press “Start camera” to request access.');
  });
}
