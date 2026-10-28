import { ToolError } from '@/lib/types';

export type RecordingFormat = 'wav' | 'webm';

export interface AnalyserLike {
  getByteFrequencyData(dataArray: Uint8Array): void;
  getByteTimeDomainData(dataArray: Uint8Array): void;
  fftSize: number;
}

export interface MediaRecorderLike {
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: (cb: (event: { data: Blob }) => void) => void;
  onerror: (cb: (event: Event) => void) => void;
  state: string;
  mimeType: string;
}

export interface MediaDevicesLike {
  getUserMedia: (constraints: { audio: boolean | MediaTrackConstraints }) => Promise<MediaStream>;
}

export interface RecorderFactory {
  isTypeSupported: (type: string) => boolean;
  create: (stream: MediaStream, options: { mimeType: string }) => MediaRecorderLike;
}

export interface MediaStreamTrackLike {
  stop(): void;
}

export interface RecordingSession {
  stream: MediaStream;
  analyser: AnalyserLike;
  recorder: MediaRecorderLike;
  chunks: Blob[];
  startTime: number;
  stopTime?: number;
  track?: MediaStreamTrackLike;
  duration?: number;
}

export function pickRecordingMimeType(
  support: ((type: string) => boolean) | null | undefined,
): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav'];
  for (const type of candidates) {
    if (support?.(type)) return type;
  }
  return 'audio/webm';
}

export function containerForMimeType(mimeType: string): 'wav' | 'webm' {
  if (mimeType.includes('webm')) return 'webm';
  return 'wav';
}

export function buildRecordingFilename(
  container: 'wav' | 'webm',
  date: Date,
  prefix: string = 'voice-recording',
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
  return `${prefix}-${ts}.${container}`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${s}s`;
}

export function formatLevel(level: number): string {
  return `${level.toFixed(1)} dB`;
}

export function getAudioLevel(analyser: AnalyserLike, dataArray: Uint8Array): number {
  analyser.getByteFrequencyData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i]!;
  }
  const average = sum / dataArray.length;
  return average - 128; // centered around 128
}

export function drawWaveform(
  analyser: AnalyserLike,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  analyser.getByteTimeDomainData(dataArray);
  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sliceWidth = width / dataArray.length;
  let x = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i]! / 128.0;
    const y = (v * height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}

export function startRecording(
  stream: MediaStream,
  factory: RecorderFactory,
  analyser: AnalyserLike,
  options: { mimeType?: string } = {},
): RecordingSession {
  const mime = options.mimeType || pickRecordingMimeType(factory.isTypeSupported);
  const recorder = factory.create(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  const startTime = Date.now();

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onerror = (e) => {
    throw new ToolError('Recording error', (e as any).message);
  };

  recorder.start(100); // timeslice in ms

  const session: RecordingSession = {
    stream,
    analyser,
    recorder,
    chunks,
    startTime,
  };

  return session;
}

export function stopRecording(session: RecordingSession): RecordingSession {
  if (session.recorder.state === 'recording') {
    session.recorder.stop();
    session.recorder.state = 'inactive';
    session.stopTime = Date.now();
    if (session.duration === undefined) {
      session.duration = session.stopTime - session.startTime;
    }
  }
  return session;
}

export function cleanupRecording(session: RecordingSession): void {
  if (session.track) {
    session.track.stop();
  }
  if (session.stream) {
    session.stream.getTracks().forEach((track) => track.stop());
  }
}
