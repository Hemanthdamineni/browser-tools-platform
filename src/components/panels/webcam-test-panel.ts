/**
 * Behaviour for the webcam test panel.
 *
 * Loaded on demand by `webcam-test.astro`, so no camera code ships to the
 * pages that do not use it.
 *
 * Everything here is local: the camera is opened with `getUserMedia`, the
 * preview is drawn into a canvas for snapshots, and the numbers are handed to
 * the tool's own `run()` so the browser and the tests share one code path.
 * Nothing is uploaded, recorded or stored, and the panel never talks to the
 * network.
 */
import type { TextRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { clearError, renderTextResult, showError } from '@/components/workbench/shared';
import {
  formatResolution,
  framesPerSecond,
  resolutionConstraint,
  roundFps,
  type CameraDevice,
  type WebcamFacts,
  type WebcamState,
} from '@/tools/device/webcam-test.core';

/** How long a measurement window lasts. */
const FPS_WINDOW_MS = 1500;
/** How long we wait for the first frame before calling the preview empty. */
const FIRST_FRAME_TIMEOUT_MS = 5000;

/** How the failure is described in the report and in the error box. */
interface CameraFailure {
  state: WebcamState;
  message: string;
  hint: string;
}

/** Map a `getUserMedia` rejection onto a state the report understands. */
function describeFailure(error: unknown): CameraFailure {
  const name = (error as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        state: 'denied',
        message: 'Camera permission was denied.',
        hint: 'Allow camera access for this site — open the padlock in the address bar, set Camera to "Allow", then start the camera again.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        state: 'no-camera',
        message: 'No camera was found on this device.',
        hint: 'Connect a camera and check that it is not disabled in your system settings, then try again.',
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        state: 'no-camera',
        message: 'This camera does not support the requested settings.',
        hint: 'Set the requested resolution to "Browser default" and try again.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        state: 'in-use',
        message: 'The camera is already in use.',
        hint: 'Close the other app or tab that is holding the camera (a video call, another tab), then start it again.',
      };
    case 'SecurityError':
      return {
        state: 'failed',
        message: 'Camera access is blocked on this page.',
        hint: 'Browsers only hand out cameras on secure pages — open this tool over https:// (or localhost), then try again.',
      };
    case 'TypeError':
      return {
        state: 'unsupported',
        message: 'This browser does not expose a camera API.',
        hint: 'Camera access needs a recent Chrome, Edge, Firefox or Safari.',
      };
    default:
      return {
        state: 'failed',
        message: 'The camera could not be started.',
        hint: 'Try again, or pick a different camera.',
      };
  }
}

/** Mount the webcam panel into a `[data-webcam-test-panel]` element. */
export function mountWebcamTestPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'webcam-test';

  const statusEl = root.querySelector<HTMLElement>('[data-wt-status]');
  const errorEl = root.querySelector<HTMLElement>('[data-wt-error]');
  const video = root.querySelector<HTMLVideoElement>('[data-wt-video]');
  const stage = root.querySelector<HTMLElement>('[data-wt-stage]');
  const placeholder = root.querySelector<HTMLElement>('[data-wt-placeholder]');
  const startBtn = root.querySelector<HTMLButtonElement>('[data-wt-start]');
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-wt-stop]');
  const snapshotBtn = root.querySelector<HTMLButtonElement>('[data-wt-snapshot]');
  const deviceSelect = root.querySelector<HTMLSelectElement>('[data-wt-device]');
  const deviceNote = root.querySelector<HTMLElement>('[data-wt-device-note]');
  const resolutionSelect = root.querySelector<HTMLSelectElement>('[data-wt-resolution]');
  const audioToggle = root.querySelector<HTMLInputElement>('[data-wt-audio]');
  const settingsToggle = root.querySelector<HTMLInputElement>('[data-wt-settings]');
  const resolutionValue = root.querySelector<HTMLElement>('[data-wt-resolution-value]');
  const fpsValue = root.querySelector<HTMLElement>('[data-wt-fps-value]');
  const audioValue = root.querySelector<HTMLElement>('[data-wt-audio-value]');
  const camerasValue = root.querySelector<HTMLElement>('[data-wt-cameras-value]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-wt-canvas]');
  const snapshotWrap = root.querySelector<HTMLElement>('[data-wt-snapshot-wrap]');
  const snapshotLink = root.querySelector<HTMLAnchorElement>('[data-wt-snapshot-link]');
  const reportWrap = root.querySelector<HTMLElement>('[data-wt-report-wrap]');
  const reportEl = root.querySelector<HTMLElement>('[data-wt-report]');
  const statsEl = root.querySelector<HTMLElement>('[data-wt-stats]');
  const notesEl = root.querySelector<HTMLElement>('[data-wt-notes]');
  const warningsEl = root.querySelector<HTMLElement>('[data-wt-warnings]');

  if (
    !statusEl ||
    !errorEl ||
    !video ||
    !stage ||
    !placeholder ||
    !startBtn ||
    !stopBtn ||
    !snapshotBtn ||
    !deviceSelect ||
    !deviceNote ||
    !resolutionSelect ||
    !audioToggle ||
    !settingsToggle ||
    !resolutionValue ||
    !fpsValue ||
    !audioValue ||
    !camerasValue ||
    !canvas ||
    !snapshotWrap ||
    !snapshotLink ||
    !reportWrap ||
    !reportEl ||
    !statsEl ||
    !notesEl ||
    !warningsEl
  ) {
    return;
  }

  let stream: MediaStream | null = null;
  let live = false;
  let cameras: CameraDevice[] = [];
  let selectedDeviceId = '';
  let measuredFps: number | null = null;
  let snapshotUrl: string | null = null;
  let audioWarning: string | null = null;

  /* Frame counting ------------------------------------------------------- */

  /** Which counter tells us how many frames the camera actually delivered. */
  type FrameSource = 'video-frame-callback' | 'decoded' | 'animation-frame';
  let frameSource: FrameSource = 'animation-frame';
  let frameCounter = 0;
  let frameBase = 0;
  let windowStartedAt = 0;
  let rvfcHandle = 0;
  let rafHandle = 0;
  let sampleTimer: number | null = null;
  let firstFrameTimer: number | null = null;

  /** The number of frames the browser has decoded for the preview. */
  function decodedFrames(): number | null {
    const quality = video.getVideoPlaybackQuality?.();
    if (!quality) return null;
    const total = quality.totalVideoFrames;
    if (typeof total === 'number') return total;
    const webkit = (quality as unknown as { webkitDecodedFrameCount?: number })
      .webkitDecodedFrameCount;
    return typeof webkit === 'number' ? webkit : null;
  }

  function currentFrameCount(): number {
    if (frameSource === 'decoded') return decodedFrames() ?? frameCounter;
    return frameCounter;
  }

  function stopMeasuring(): void {
    if (sampleTimer !== null) {
      window.clearInterval(sampleTimer);
      sampleTimer = null;
    }
    if (rvfcHandle && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(rvfcHandle);
    }
    rvfcHandle = 0;
    if (rafHandle) window.cancelAnimationFrame(rafHandle);
    rafHandle = 0;
  }

  function startMeasuring(): void {
    stopMeasuring();
    frameCounter = 0;
    frameBase = 0;
    windowStartedAt = performance.now();

    if (typeof video.requestVideoFrameCallback === 'function') {
      // The most truthful counter: it fires once per frame the compositor gets.
      frameSource = 'video-frame-callback';
      const step = () => {
        frameCounter += 1;
        rvfcHandle = video.requestVideoFrameCallback(step);
      };
      rvfcHandle = video.requestVideoFrameCallback(step);
    } else if (decodedFrames() !== null) {
      frameSource = 'decoded';
    } else {
      // Last resort: the display refresh rate, which is an upper bound only.
      frameSource = 'animation-frame';
      const step = () => {
        frameCounter += 1;
        rafHandle = window.requestAnimationFrame(step);
      };
      rafHandle = window.requestAnimationFrame(step);
    }

    sampleTimer = window.setInterval(sampleFrames, FPS_WINDOW_MS);
  }

  function sampleFrames(): void {
    const now = performance.now();
    const elapsed = now - windowStartedAt;
    const count = currentFrameCount();
    const frames = Math.max(0, count - frameBase);
    frameBase = count;
    windowStartedAt = now;
    measuredFps = roundFps(framesPerSecond(frames, elapsed));
    updateReadout();
    void refreshReport('live', audioWarning);
  }

  /* Readout -------------------------------------------------------------- */

  function trackSettings(): MediaTrackSettings | null {
    const track = stream?.getVideoTracks()[0];
    return track?.getSettings?.() ?? null;
  }

  function frameRateText(): string {
    const parts: string[] = [];
    const settings = trackSettings();
    if (typeof settings?.frameRate === 'number') {
      parts.push(`${roundFps(settings.frameRate)} fps reported`);
    }
    if (measuredFps !== null) parts.push(`${roundFps(measuredFps)} fps measured`);
    if (!parts.length) return '—';
    return parts.join(' · ');
  }

  function updateReadout(): void {
    const settings = trackSettings();
    resolutionValue.textContent = formatResolution(settings?.width ?? null, settings?.height ?? null);
    fpsValue.textContent = frameRateText();
    audioValue.textContent = live
      ? stream && stream.getAudioTracks().length > 0
        ? 'Yes — an audio track is live'
        : 'No — video only'
      : '—';
    camerasValue.textContent = cameras.length ? `${cameras.length} detected` : 'None detected';
  }

  /* Report --------------------------------------------------------------- */

  function collectFacts(state: WebcamState, errorMessage: string | null): WebcamFacts {
    const track = stream?.getVideoTracks()[0] ?? null;
    const settings = trackSettings();
    const chosen = cameras.find((camera) => camera.deviceId === selectedDeviceId);
    return {
      state,
      cameraLabel: track?.label || chosen?.label || '',
      width: settings?.width ?? null,
      height: settings?.height ?? null,
      reportedFps: typeof settings?.frameRate === 'number' ? settings.frameRate : null,
      measuredFps,
      hasAudio: (stream?.getAudioTracks().length ?? 0) > 0,
      cameras,
      settings: settings ? { ...settings } : null,
      errorMessage,
    };
  }

  function renderStats(stats: Record<string, string | number> | undefined): void {
    statsEl.replaceChildren();
    if (!stats) return;
    for (const [label, value] of Object.entries(stats)) {
      const dt = document.createElement('dt');
      dt.className = 'font-medium text-[rgb(var(--text-muted))]';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.className = 'font-mono text-xs text-[rgb(var(--text))]';
      dd.textContent = String(value);
      statsEl.append(dt, dd);
    }
  }

  function renderNotes(notes: string[] | undefined, warnings: string[] | undefined): void {
    notesEl.replaceChildren();
    for (const note of notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.appendChild(li);
    }
    warningsEl.replaceChildren();
    for (const warning of warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      // The symbol carries the meaning too — the colour is only a nudge.
      li.textContent = `⚠ ${warning}`;
      warningsEl.appendChild(li);
    }
  }

  /** Hand what we measured to the tool and show what it makes of it. */
  async function refreshReport(state: WebcamState, errorMessage: string | null): Promise<void> {
    const facts = collectFacts(state, errorMessage);
    try {
      const result = await runToolById<TextRunResult>(
        toolId,
        {
          text: JSON.stringify(facts),
          options: {
            resolution: resolutionSelect.value,
            includeSettings: settingsToggle.checked,
          },
        },
      );
      renderTextResult(reportEl, result);
      renderStats(result.stats);
      renderNotes(result.notes, result.warnings);
      reportWrap.hidden = false;
    } catch (error) {
      const failure = error as Error & { hint?: string };
      showError(
        errorEl,
        failure.message || 'The report could not be built.',
        failure.hint ?? 'Reload the page and try again.',
      );
    }
  }

  /* Devices -------------------------------------------------------------- */

  function renderDevices(): void {
    deviceSelect.replaceChildren();
    if (!cameras.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No camera detected';
      deviceSelect.appendChild(option);
      deviceSelect.disabled = true;
      deviceNote.textContent = 'No camera was found on this device.';
      return;
    }

    deviceSelect.disabled = false;
    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label.trim() || `Camera ${index + 1}`;
      deviceSelect.appendChild(option);
    });

    const named = cameras.filter((camera) => camera.label.trim().length > 0).length;
    deviceNote.textContent = named
      ? `${cameras.length} camera${cameras.length === 1 ? '' : 's'} found.`
      : 'Camera names appear after you allow access.';

    const wanted = cameras.some((camera) => camera.deviceId === selectedDeviceId)
      ? selectedDeviceId
      : cameras[0]!.deviceId;
    deviceSelect.value = wanted;
    selectedDeviceId = wanted;
  }

  async function refreshDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      deviceNote.textContent = 'This browser does not expose a device list.';
      return;
    }
    let found: MediaDeviceInfo[];
    try {
      found = await navigator.mediaDevices.enumerateDevices();
    } catch {
      deviceNote.textContent = 'The camera list could not be read.';
      return;
    }
    cameras = found
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({ deviceId: device.deviceId, label: device.label }));
    renderDevices();
    updateReadout();
  }

  /* Camera --------------------------------------------------------------- */

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  function buildVideoConstraints(): MediaTrackConstraints {
    const constraints: MediaTrackConstraints = {};
    if (selectedDeviceId) constraints.deviceId = { exact: selectedDeviceId };
    let size: { width: number; height: number } | null = null;
    try {
      size = resolutionConstraint(resolutionSelect.value);
    } catch {
      size = null;
    }
    if (size) {
      constraints.width = { ideal: size.width };
      constraints.height = { ideal: size.height };
    }
    return constraints;
  }

  function stopCamera(message = 'Camera off.'): void {
    stopMeasuring();
    if (firstFrameTimer !== null) {
      window.clearTimeout(firstFrameTimer);
      firstFrameTimer = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    live = false;
    measuredFps = null;
    video.srcObject = null;
    stage.hidden = true;
    placeholder.hidden = false;
    stopBtn.hidden = true;
    snapshotBtn.hidden = true;
    startBtn.hidden = false;
    startBtn.disabled = false;
    updateReadout();
    announce(message);
  }

  async function openStream(wantsAudio: boolean): Promise<MediaStream> {
    const constraints = buildVideoConstraints();
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: wantsAudio,
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name ?? '';
      // A camera that vanished (or a stale device id) should fall back to the
      // default camera rather than fail outright.
      if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: wantsAudio });
      }
      throw error;
    }
  }

  async function start(): Promise<void> {
    if (live) return;
    clearError(errorEl);
    startBtn.disabled = true;
    announce('Requesting camera permission…');
    audioWarning = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('getUserMedia is unavailable'), { name: 'TypeError' });
      }

      const wantsAudio = audioToggle.checked;
      let media: MediaStream;
      try {
        media = await openStream(wantsAudio);
      } catch (error) {
        // A refused microphone must not cost us the camera test.
        if (!wantsAudio) throw error;
        media = await openStream(false);
        audioWarning = 'The microphone could not be opened — the preview continues with video only.';
      }

      stream = media;
      live = true;
      video.srcObject = media;
      try {
        await video.play();
      } catch {
        // Autoplay can be refused; the preview still works once it is allowed.
      }
      stage.hidden = false;
      placeholder.hidden = true;
      stopBtn.hidden = false;
      snapshotBtn.hidden = false;
      startBtn.hidden = true;

      const track = media.getVideoTracks()[0];
      const deviceId = track?.getSettings?.().deviceId;
      if (deviceId) selectedDeviceId = deviceId;

      // The names only show up once the permission has been granted.
      await refreshDevices();
      updateReadout();
      startMeasuring();
      announce('Camera running.');

      firstFrameTimer = window.setTimeout(() => {
        firstFrameTimer = null;
        if (live && !video.videoWidth) {
          showError(
            errorEl,
            'The camera started, but no frames arrived.',
            'The preview stays empty — close other apps that may be holding the camera and start it again.',
          );
          announce('The camera started, but the preview is empty.');
        }
      }, FIRST_FRAME_TIMEOUT_MS);

      await refreshReport('live', audioWarning);
    } catch (error) {
      const failure = describeFailure(error);
      showError(errorEl, failure.message, failure.hint);
      announce(`${failure.message} The camera is off.`);
      startBtn.disabled = false;
      startBtn.hidden = false;
      stopBtn.hidden = true;
      snapshotBtn.hidden = true;
      await refreshReport(failure.state, failure.message);
    }
  }

  /* Snapshot ------------------------------------------------------------- */

  async function takeSnapshot(): Promise<void> {
    if (!live || !video.videoWidth) {
      announce('There is no frame to capture yet.');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      showError(
        errorEl,
        'This browser cannot open a 2D canvas.',
        'Try a different browser to take a snapshot.',
      );
      return;
    }
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      showError(errorEl, 'The frame could not be drawn.', 'Try the snapshot again.');
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) {
      showError(errorEl, 'The snapshot could not be encoded.', 'Try the snapshot again.');
      return;
    }
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    snapshotUrl = URL.createObjectURL(blob);
    snapshotLink.href = snapshotUrl;
    snapshotLink.download = `webcam-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    snapshotWrap.hidden = false;
    announce('Snapshot taken — it was drawn in this tab and never uploaded.');
  }

  /* Wiring --------------------------------------------------------------- */

  startBtn.addEventListener('click', () => void start());
  stopBtn.addEventListener('click', () => {
    stopCamera('Camera off.');
    void refreshReport('failed', 'The camera was stopped.');
  });
  snapshotBtn.addEventListener('click', () => void takeSnapshot());

  deviceSelect.addEventListener('change', () => {
    selectedDeviceId = deviceSelect.value;
    if (!live) return;
    stopCamera('Switching camera…');
    void start();
  });

  resolutionSelect.addEventListener('change', () => {
    if (!live) return;
    stopCamera('Applying the new resolution…');
    void start();
  });

  audioToggle.addEventListener('change', () => {
    if (!live) return;
    stopCamera('Applying the new audio setting…');
    void start();
  });

  settingsToggle.addEventListener('change', () => {
    if (!live) return;
    void refreshReport('live', audioWarning);
  });

  video.addEventListener('loadeddata', () => {
    if (firstFrameTimer !== null) {
      window.clearTimeout(firstFrameTimer);
      firstFrameTimer = null;
    }
    updateReadout();
  });

  const release = () => {
    stopCamera();
    if (snapshotUrl) {
      URL.revokeObjectURL(snapshotUrl);
      snapshotUrl = null;
    }
  };
  window.addEventListener('pagehide', release);
  window.addEventListener('beforeunload', release);

  /* Boot ----------------------------------------------------------------- */

  updateReadout();
  if (!navigator.mediaDevices?.getUserMedia) {
    startBtn.disabled = true;
    deviceSelect.disabled = true;
    showError(
      errorEl,
      'This browser does not expose a camera API.',
      'Camera access needs a recent Chrome, Edge, Firefox or Safari over https://.',
    );
    announce('Camera testing is not available in this browser.');
    return;
  }
  // The device list is available before permission, but the names are not.
  void refreshDevices();
  announce('Camera off — start it to see the real resolution and frame rate.');
}
