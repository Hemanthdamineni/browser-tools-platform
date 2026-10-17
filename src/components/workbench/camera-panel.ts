/**
 * Camera panel for the QR & Barcode Scanner. Loaded on demand by
 * `CameraPanel.astro` so no camera code ships to pages that don't scan.
 *
 * Everything here is local: frames are read from the `<video>` element and
 * decoded in this tab. Nothing is recorded, stored or transmitted.
 */
import { ToolError } from '@/lib/types';
import { copyText } from '@/lib/clipboard';
import {
  ALL_FORMATS,
  CAMERA_MAX_EDGE,
  describeCameraError,
  detectCodes,
  fallbackDecoderLoading,
  nativeDetectorAvailable,
  type DetectedCode,
} from '@/tools/generators/qr-decode';
import { classifyPayload, payloadActions, type ParsedPayload } from '@/tools/generators/qr-payload';
import { clearError, showError } from './shared';

/** How often a live frame is examined. Fast enough to feel instant, cheap enough for phones. */
const TICK_MS = 200;
/** While the native detector is running, retry the software decoder this often. */
const FALLBACK_RETRY_MS = 1500;

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

/** Mount the camera UI into a `[data-camera-panel]` element. */
export function mountCameraPanel(panel: HTMLElement): void {
  // Astro always renders these; the guard keeps a markup change from crashing.
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-camera-start]')!;
  const stopBtn = panel.querySelector<HTMLButtonElement>('[data-camera-stop]')!;
  const scanBtn = panel.querySelector<HTMLButtonElement>('[data-camera-scan]')!;
  const video = panel.querySelector<HTMLVideoElement>('[data-camera-video]')!;
  const stage = panel.querySelector<HTMLElement>('[data-camera-stage]')!;
  const status = panel.querySelector<HTMLElement>('[data-camera-status]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-camera-error]')!;
  const loading = panel.querySelector<HTMLElement>('[data-camera-loading]');
  const results = panel.querySelector<HTMLElement>('[data-camera-results]')!;
  const deviceSelect = panel.querySelector<HTMLSelectElement>('[data-camera-device]');
  const deviceWrap = panel.querySelector<HTMLElement>('[data-camera-device-wrap]');
  if (!startBtn || !stopBtn || !scanBtn || !video || !stage || !status || !errorBox || !results) {
    return;
  }

  const native = nativeDetectorAvailable();
  let stream: MediaStream | null = null;
  let timer: number | null = null;
  let live = false;
  let inFlight = false;
  let foundSomething = false;
  let deviceId = '';
  let lastFallbackAt = 0;

  const announce = (message: string) => {
    status.textContent = message;
  };

  const setLoading = (message: string | null) => {
    if (!loading) return;
    loading.textContent = message ?? '';
    loading.hidden = message === null;
  };

  function stopLoop(): void {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function stopCamera(message = 'Camera off.'): void {
    stopLoop();
    live = false;
    inFlight = false;
    foundSomething = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    stage.hidden = true;
    stopBtn.hidden = true;
    scanBtn.hidden = true;
    startBtn.hidden = false;
    startBtn.disabled = false;
    setLoading(null);
    announce(message);
  }

  /* ---------------------------------------------------------------------- */
  /*  Result rendering                                                      */
  /* ---------------------------------------------------------------------- */

  function fieldList(parsed: ParsedPayload): HTMLElement {
    const dl = element('dl', 'mt-2 grid gap-1 text-sm sm:grid-cols-[minmax(6rem,auto)_1fr]');
    for (const field of parsed.fields) {
      const dt = element(
        'dt',
        'font-medium text-[rgb(var(--text-muted))] sm:text-right',
        `${field.label}:`,
      );
      const dd = element(
        'dd',
        'min-w-0 break-all font-mono text-xs text-[rgb(var(--text))]',
        field.value,
      );
      dl.append(dt, dd);
    }
    return dl;
  }

  function actionRow(parsed: ParsedPayload): HTMLElement {
    const row = element('div', 'mt-3 flex flex-wrap items-center gap-2');
    for (const action of payloadActions(parsed)) {
      if (action.href && (action.id === 'open' || action.id === 'email' || action.id === 'call')) {
        const link = element('a', 'btn btn-subtle btn-sm', action.label);
        link.href = action.href;
        if (/^https?:/i.test(action.href)) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        row.appendChild(link);
        continue;
      }
      const button = element('button', 'btn btn-subtle btn-sm', action.label);
      button.type = 'button';
      button.addEventListener('click', async () => {
        const ok = await copyText(action.value ?? parsed.raw);
        announce(ok ? `${action.label} — copied.` : 'Copy failed — select the text instead.');
      });
      row.appendChild(button);
    }
    return row;
  }

  function renderCode(code: DetectedCode, index: number, total: number): HTMLElement {
    const parsed = classifyPayload(code.raw);
    const card = element('div', 'rounded-lg border p-3');
    const title = element(
      'h3',
      'text-sm font-semibold text-[rgb(var(--text))]',
      total > 1
        ? `Code ${index + 1} of ${total} — ${parsed.typeLabel}`
        : `${parsed.typeLabel} · ${code.format || 'code'}`,
    );
    card.appendChild(title);
    if (parsed.fields.length) card.appendChild(fieldList(parsed));
    else card.appendChild(element('p', 'mt-2 text-sm text-[rgb(var(--text-muted))]', '(empty)'));

    for (const warning of parsed.warnings) {
      const note = element('p', 'mt-2 text-xs', `⚠ ${warning}`);
      note.style.color = 'rgb(var(--warning))';
      card.appendChild(note);
    }

    card.appendChild(actionRow(parsed));

    const details = element('details', 'mt-3 text-xs');
    const summary = element(
      'summary',
      'cursor-pointer text-[rgb(var(--text-muted))]',
      'Raw payload',
    );
    const raw = element('pre', 'mt-1 overflow-x-auto whitespace-pre-wrap break-all', code.raw);
    details.append(summary, raw);
    card.appendChild(details);
    return card;
  }

  function renderFound(codes: DetectedCode[]): void {
    results.replaceChildren();
    codes.forEach((code, i) => results.appendChild(renderCode(code, i, codes.length)));
  }

  /* ---------------------------------------------------------------------- */
  /*  Decoding                                                              */
  /* ---------------------------------------------------------------------- */

  function onDecodeFailure(err: unknown): void {
    stopCamera('Camera stopped.');
    if (err instanceof ToolError) showError(errorBox, err.message, err.hint);
    else {
      showError(
        errorBox,
        'The frame could not be decoded.',
        'Try again, or scan an uploaded image below.',
      );
    }
  }

  async function scanFrame(forceFallback: boolean): Promise<void> {
    if (!live || inFlight || !video.videoWidth) return;
    inFlight = true;
    const now = Date.now();
    const useFallback = forceFallback || !native || now - lastFallbackAt > FALLBACK_RETRY_MS;
    if (useFallback) {
      lastFallbackAt = now;
      if (!fallbackDecoderLoading()) {
        setLoading(
          'Loading the fallback decoder… this is a one-time download served from this site.',
        );
      }
    }
    try {
      const outcome = await detectCodes(video, {
        formats: [...ALL_FORMATS],
        maxEdge: CAMERA_MAX_EDGE,
        tryFallback: useFallback,
        invert: true,
      });
      setLoading(null);
      if (!outcome.codes.length) return;
      foundSomething = true;
      renderFound(outcome.codes);
      clearError(errorBox);
      const first = classifyPayload(outcome.codes[0]!.raw);
      announce(
        outcome.codes.length > 1
          ? `Found ${outcome.codes.length} codes: ${outcome.codes
              .map((c) => classifyPayload(c.raw).typeLabel)
              .join(', ')}. Scanning paused.`
          : `Code found: ${first.typeLabel} — ${first.summary}. Scanning paused.`,
      );
      stopLoop();
    } catch (err) {
      setLoading(null);
      onDecodeFailure(err);
    } finally {
      inFlight = false;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Camera lifecycle                                                      */
  /* ---------------------------------------------------------------------- */

  async function populateDevices(): Promise<void> {
    if (!deviceSelect || !deviceWrap || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      if (cameras.length < 2) return;
      deviceSelect.replaceChildren();
      cameras.forEach((camera, i) => {
        const option = element('option', undefined, camera.label || `Camera ${i + 1}`);
        option.value = camera.deviceId;
        option.selected = camera.deviceId === deviceId;
        deviceSelect.appendChild(option);
      });
      deviceWrap.hidden = false;
    } catch {
      /* device labels are optional */
    }
  }

  async function start(): Promise<void> {
    if (live) return;
    clearError(errorBox);
    startBtn.disabled = true;
    announce('Requesting camera permission…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('getUserMedia is unavailable'), { name: 'TypeError' });
      }
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : {
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
            audio: false,
          };
      const media = await navigator.mediaDevices.getUserMedia(constraints);
      stream = media;
      const track = media.getVideoTracks()[0];
      if (track) deviceId = track.getSettings?.().deviceId ?? deviceId;
      video.srcObject = media;
      await video.play().catch(() => undefined);
      live = true;
      foundSomething = false;
      lastFallbackAt = 0;
      results.replaceChildren();
      stage.hidden = false;
      startBtn.hidden = true;
      stopBtn.hidden = false;
      scanBtn.hidden = false;
      announce(
        native
          ? 'Camera on — looking for a code with the browser’s built-in detector.'
          : 'Camera on — looking for a code with the bundled decoder.',
      );
      void populateDevices();
      stopLoop();
      timer = window.setInterval(() => void scanFrame(false), TICK_MS);
    } catch (err) {
      const toolError = describeCameraError(err);
      showError(errorBox, toolError.message, toolError.hint);
      announce('Camera could not start.');
      startBtn.disabled = false;
    }
  }

  startBtn.addEventListener('click', () => void start());
  stopBtn.addEventListener('click', () => stopCamera());
  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    announce('Checking this frame…');
    await scanFrame(true);
    scanBtn.disabled = false;
    if (live && !foundSomething) announce('No code found in this frame — keep the camera steady.');
  });
  deviceSelect?.addEventListener('change', () => {
    deviceId = deviceSelect.value;
    stopCamera('Switching camera…');
    void start();
  });

  window.addEventListener('pagehide', () => stopCamera());
  window.addEventListener('beforeunload', () => stopCamera());
}
