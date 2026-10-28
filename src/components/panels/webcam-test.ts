/**
 * The webcam-test panel.
 *
 * Handles camera permission, live preview, reading track settings,
 * and taking snapshots.
 */
import { downloadBlob } from '@/lib/files';
import { imageToPngBlob } from '../workbench/shared';
import { clearError, showError } from '../workbench/shared';

const FPS_SAMPLES = 30;
const FPS_WINDOW_MS = 1000;

export function mountWebcamTestWorkbench(root: HTMLElement): void {
  const deviceSelect = root.querySelector<HTMLSelectElement>('[data-wt-device]')!;
  const resolutionSelect = root.querySelector<HTMLSelectElement>('[data-wt-resolution]')!;
  const fpsSelect = root.querySelector<HTMLSelectElement>('[data-wt-fps]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-wt-start]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-wt-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-wt-status]')!;
  const widthEl = root.querySelector<HTMLElement>('[data-wt-width]')!;
  const heightEl = root.querySelector<HTMLElement>('[data-wt-height]')!;
  const fpsEl = root.querySelector<HTMLElement>('[data-wt-fps]')!;
  const aspectEl = root.querySelector<HTMLElement>('[data-wt-aspect]')!;
  const video = root.querySelector<HTMLVideoElement>('[data-wt-preview]')!;
  const snapshotWrap = root.querySelector<HTMLElement>('[data-wt-snapshot-wrap]')!;
  const snapshotBtn = root.querySelector<HTMLButtonElement>('[data-wt-snapshot]')!;
  const downloadLink = root.querySelector<HTMLAnchorElement>('[data-wt-download]')!;
  const readout = root.querySelector<HTMLElement>('[data-wt-readout]')!;

  if (!deviceSelect || !resolutionSelect || !fpsSelect || !startBtn || !stopBtn || !statusEl ||
      !widthEl || !heightEl || !fpsEl || !aspectEl || !video || !snapshotWrap || !snapshotBtn ||
      !downloadLink || !readout) {
    return;
  }

  let stream: MediaStream | null = null;
  let animationFrame: number | null = null;
  let frameTimes: number[] = [];
  let snapshotBlob: Blob | null = null;

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function stopStream(): void {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    video.srcObject = null;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    frameTimes = [];
  }

  function updateReadouts(settings: MediaTrackSettings): void {
    widthEl.textContent = settings.width?.toString() ?? '–';
    heightEl.textContent = settings.height?.toString() ?? '–';
    fpsEl.textContent = settings.frameRate?.toFixed(1) ?? '–';
    const aspect = settings.width && settings.height ? (settings.width / settings.height).toFixed(2) : '–';
    aspectEl.textContent = aspect;
  }

  function computeFps(): number {
    const now = performance.now();
    frameTimes.push(now);
    const cutoff = now - FPS_WINDOW_MS;
    frameTimes = frameTimes.filter((t) => t > cutoff);
    if (frameTimes.length < 2) return 0;
    return (frameTimes.length - 1) / ((frameTimes[frameTimes.length - 1]! - frameTimes[0]!) / 1000);
  }

  function tick(): void {
    const fps = computeFps();
    if (fps > 0) {
      fpsEl.textContent = fps.toFixed(1);
    }
    animationFrame = requestAnimationFrame(tick);
  }

  async function populateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      if (cameras.length === 0) {
        announce('No cameras found.');
        return;
      }
      deviceSelect.innerHTML = '<option value="">Select a camera…</option>';
      cameras.forEach((camera, index) => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        option.textContent = camera.label || `Camera ${index + 1}`;
        deviceSelect.appendChild(option);
      });
      if (cameras.length > 0) {
        deviceSelect.value = cameras[0]!.deviceId;
        void populateResolutionsAndFps(cameras[0]!.deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      announce('Could not enumerate cameras.');
    }
  }

  async function populateResolutionsAndFps(deviceId: string): Promise<void> {
    // Common resolutions and frame rates to test
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 640, height: 480 },
      { width: 320, height: 240 },
    ];
    const frameRates = [60, 30, 24, 15];

    resolutionSelect.innerHTML = '<option value="">Auto</option>';
    fpsSelect.innerHTML = '<option value="">Auto</option>';

    // Test what the camera supports
    for (const res of resolutions) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: res.width }, height: { ideal: res.height } },
        });
        const track = testStream.getVideoTracks()[0];
        if (!track) {
          testStream.getTracks().forEach((t) => t.stop());
          continue;
        }
        const settings = track.getSettings();
        const opt = document.createElement('option');
        opt.value = `${settings.width}x${settings.height}`;
        opt.textContent = `${settings.width} × ${settings.height}`;
        if (resolutionSelect.querySelector(`option[value="${opt.value}"]`) === null) {
          resolutionSelect.appendChild(opt);
        }
        testStream.getTracks().forEach((t) => t.stop());
      } catch {
        // Resolution not supported, skip
      }
    }

    for (const fps of frameRates) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, frameRate: { ideal: fps } },
        });
        const track = testStream.getVideoTracks()[0];
        if (!track) {
          testStream.getTracks().forEach((t) => t.stop());
          continue;
        }
        const settings = track.getSettings();
        const opt = document.createElement('option');
        opt.value = settings.frameRate?.toString() ?? fps.toString();
        opt.textContent = `${settings.frameRate ?? fps} fps`;
        if (fpsSelect.querySelector(`option[value="${opt.value}"]`) === null) {
          fpsSelect.appendChild(opt);
        }
        testStream.getTracks().forEach((t) => t.stop());
      } catch {
        // Frame rate not supported, skip
      }
    }
  }

  async function startTest(): Promise<void> {
    const deviceId = deviceSelect.value;
    if (!deviceId) {
      showError(root, 'No camera selected.', 'Pick a camera from the dropdown.');
      return;
    }

    clearError(root);
    announce('Starting camera…');
    startBtn.disabled = true;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: deviceId },
        },
      };

      if (resolutionSelect.value) {
        const [w, h] = resolutionSelect.value.split('x').map(Number);
        if (w && h) {
          (constraints.video as MediaTrackConstraints).width = { ideal: w };
          (constraints.video as MediaTrackConstraints).height = { ideal: h };
        }
      }
      if (fpsSelect.value) {
        (constraints.video as MediaTrackConstraints).frameRate = { ideal: Number(fpsSelect.value) };
      }

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const track = stream.getVideoTracks()[0];
      if (track) {
        updateReadouts(track.getSettings());
      }

      frameTimes = [];
      animationFrame = requestAnimationFrame(tick);

      startBtn.disabled = true;
      stopBtn.disabled = false;
      snapshotWrap.hidden = false;
      readout.hidden = false;
      announce('Camera running — live preview active.');
    } catch (err) {
      const e = err as Error & { name?: string };
      let message = 'Could not start camera.';
      let hint = 'Check that no other app is using the camera and try again.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        message = 'Camera permission denied.';
        hint = 'Allow camera access in the browser prompt and reload.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        message = 'No camera found.';
        hint = 'Connect a camera and reload the page.';
      } else if (e.name === 'NotReadableError') {
        message = 'Camera is in use by another application.';
        hint = 'Close other apps using the camera and try again.';
      }
      showError(root, message, hint);
      announce('Failed to start camera.');
      startBtn.disabled = false;
    }
  }

  function stopTest(): void {
    stopStream();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    snapshotWrap.hidden = true;
    readout.hidden = true;
    widthEl.textContent = '–';
    heightEl.textContent = '–';
    fpsEl.textContent = '–';
    aspectEl.textContent = '–';
    snapshotBlob = null;
    downloadLink.href = '#';
    announce('Camera stopped.');
  }

  async function takeSnapshot(): Promise<void> {
    if (!stream || video.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      snapshotBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
      });
      downloadLink.href = URL.createObjectURL(snapshotBlob);
      downloadLink.download = `webcam-snapshot-${Date.now()}.png`;
      announce('Snapshot captured — click Download PNG to save.');
    } catch (err) {
      console.error('Snapshot failed:', err);
      announce('Failed to capture snapshot.');
    }
  }

  // Event listeners
  deviceSelect.addEventListener('change', async () => {
    if (stream) {
      stopTest();
    }
    if (deviceSelect.value) {
      await populateResolutionsAndFps(deviceSelect.value);
    }
  });

  startBtn.addEventListener('click', startTest);
  stopBtn.addEventListener('click', stopTest);
  snapshotBtn.addEventListener('click', takeSnapshot);

  // Cleanup
  const cleanup = (): void => {
    stopStream();
    if (snapshotBlob) {
      URL.revokeObjectURL(downloadLink.href);
    }
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initialize
  void populateDevices();
}