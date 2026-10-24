import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gpx-track-stats.meta';

const MAX_BYTES = 25 * 1024 * 1024;
const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;
const METRES_PER_FOOT = 0.3048;

interface Point {
  lat: number;
  lon: number;
  ele: number | null;
  time: number | null;
}

interface Vertex extends Point {
  /** Cumulative distance from the first point, in kilometres. */
  cum: number;
}

function attrOf(attrs: string, name: string): string | null {
  const match = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'iu').exec(attrs);
  return match === null ? null : (match[1] ?? null);
}

function tagOf(inner: string, name: string): string | null {
  const match = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>', 'iu').exec(inner);
  return match === null ? null : (match[1] ?? '').trim();
}

function numberOf(raw: string | null): number | null {
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parsePoints(xml: string): Point[] {
  const points: Point[] = [];
  const re = /<(trkpt|rtept)\b([^>]*?)(\/?)>/giu;
  let match = re.exec(xml);
  while (match !== null) {
    const tag = match[1] ?? '';
    const attrs = match[2] ?? '';
    const selfClosing = match[3] === '/';
    let inner = '';
    if (!selfClosing) {
      const close = xml.indexOf('</' + tag + '>', re.lastIndex);
      if (close !== -1) inner = xml.slice(re.lastIndex, close);
    }

    const lat = numberOf(attrOf(attrs, 'lat'));
    const lon = numberOf(attrOf(attrs, 'lon'));
    if (lat !== null && lon !== null) {
      const rawTime = tagOf(inner, 'time');
      const parsedTime = rawTime === null ? NaN : Date.parse(rawTime);
      points.push({
        lat,
        lon,
        ele: numberOf(tagOf(inner, 'ele')),
        time: Number.isNaN(parsedTime) ? null : parsedTime,
      });
    }
    match = re.exec(xml);
  }
  return points;
}

function haversine(a: Point, b: Point): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildVertices(points: Point[]): Vertex[] {
  const vertices: Vertex[] = [];
  let cum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point === undefined) continue;
    if (i > 0) {
      const previous = points[i - 1];
      if (previous !== undefined) cum += haversine(previous, point);
    }
    vertices.push({ ...point, cum });
  }
  return vertices;
}

function gainLoss(elevations: number[], threshold: number): { gain: number; loss: number } {
  if (elevations.length < 2) return { gain: 0, loss: 0 };
  let gain = 0;
  let loss = 0;
  let base = elevations[0] ?? 0;
  for (let i = 1; i < elevations.length; i += 1) {
    const value = elevations[i];
    if (value === undefined) continue;
    const delta = value - base;
    if (delta !== 0 && Math.abs(delta) >= threshold) {
      if (delta > 0) gain += delta;
      else loss -= delta;
      base = value;
    }
  }
  return { gain, loss };
}

function elevationsOf(vertices: Vertex[]): number[] {
  const out: number[] = [];
  for (const vertex of vertices) if (vertex.ele !== null) out.push(vertex.ele);
  return out;
}

/**
 * Break the track into fixed-length splits. A boundary that falls inside a
 * segment is interpolated, so a full split really is one kilometre of track.
 */
function buildSplits(vertices: Vertex[], splitKm: number): Vertex[][] {
  const groups: Vertex[][] = [];
  let current: Vertex[] = [];
  let boundary = splitKm;

  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    if (vertex === undefined) continue;

    while (vertex.cum >= boundary) {
      const previous = i > 0 ? vertices[i - 1] : undefined;
      let edge: Vertex;
      if (previous !== undefined && vertex.cum > previous.cum) {
        const t = (boundary - previous.cum) / (vertex.cum - previous.cum);
        edge = {
          lat: previous.lat + (vertex.lat - previous.lat) * t,
          lon: previous.lon + (vertex.lon - previous.lon) * t,
          ele:
            previous.ele === null || vertex.ele === null
              ? null
              : previous.ele + (vertex.ele - previous.ele) * t,
          time:
            previous.time === null || vertex.time === null
              ? null
              : previous.time + (vertex.time - previous.time) * t,
          cum: boundary,
        };
      } else {
        edge = { ...vertex, cum: boundary };
      }
      current.push(edge);
      groups.push(current);
      current = [edge];
      boundary += splitKm;
    }

    // Keep the vertex in the open split unless it landed exactly on the boundary
    // that was just emitted, which would otherwise duplicate it.
    const last = current[current.length - 1];
    if (last === undefined || vertex.cum > last.cum + 1e-9) current.push(vertex);
  }

  if (current.length > 1) groups.push(current);
  return groups;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'n/a';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm ' + secs + 's';
  if (minutes > 0) return minutes + 'm ' + secs + 's';
  return secs + 's';
}

function formatPace(secondsPerUnit: number, unit: string): string {
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return 'n/a';
  const total = Math.round(secondsPerUnit);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return minutes + ':' + String(secs).padStart(2, '0') + ' /' + unit;
}

function formatDistance(km: number, imperial: boolean): string {
  if (imperial) {
    const miles = km / KM_PER_MILE;
    return miles >= 0.1 ? miles.toFixed(2) + ' mi' : Math.round(miles * 5280) + ' ft';
  }
  return km >= 1 ? km.toFixed(2) + ' km' : Math.round(km * 1000) + ' m';
}

function formatElevation(metres: number, imperial: boolean): string {
  return imperial
    ? Math.round(metres / METRES_PER_FOOT) + ' ft'
    : Math.round(metres) + ' m';
}

function formatSpeed(kmh: number, imperial: boolean): string {
  return imperial
    ? (kmh / KM_PER_MILE).toFixed(2) + ' mph'
    : kmh.toFixed(2) + ' km/h';
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const imperial = String(o.units ?? 'metric') === 'imperial';
  const splitChoice = String(o.splits ?? 'off');
  const threshold = Math.max(0, Math.min(100, Number(o.eleThreshold ?? 0)));

  const notes: string[] = [];
  const warnings: string[] = [];

  const file = input.files[0];
  let xml = '';
  if (file !== undefined) {
    if (file.size > MAX_BYTES) {
      throw new ToolError('That file is too large.', 'GPX tracks under 25 MB are supported.');
    }
    xml = await file.text();
  } else {
    xml = String(input.text ?? '');
  }

  if (xml.trim() === '') {
    throw new ToolError('Choose a GPX file or paste GPX XML.', 'The file must end in .gpx.');
  }
  if (!/<gpx\b/iu.test(xml)) {
    warnings.push('No <gpx> root element found - the file may not be a GPX track.');
  }

  const points = parsePoints(xml);
  if (points.length === 0) {
    throw new ToolError(
      'No track points found in this file.',
      'GPX positions live in <trkpt> or <rtept> elements.',
    );
  }

  const vertices = buildVertices(points);
  const totalKm = vertices.length > 0 ? (vertices[vertices.length - 1]?.cum ?? 0) : 0;
  const elevations = elevationsOf(vertices);
  const { gain, loss } = gainLoss(elevations, threshold);

  const times: number[] = [];
  for (const vertex of vertices) if (vertex.time !== null) times.push(vertex.time);
  const startTime = times.length > 0 ? (times[0] ?? null) : null;
  const endTime = times.length > 0 ? (times[times.length - 1] ?? null) : null;
  const duration =
    startTime !== null && endTime !== null ? Math.max(0, (endTime - startTime) / 1000) : null;

  const minEle = elevations.length > 0 ? Math.min(...elevations) : null;
  const maxEle = elevations.length > 0 ? Math.max(...elevations) : null;

  const lats = vertices.map((vertex) => vertex.lat);
  const lons = vertices.map((vertex) => vertex.lon);

  const avgSpeed = duration !== null && duration > 0 ? totalKm / (duration / 3600) : null;
  const paceSeconds = avgSpeed !== null && avgSpeed > 0 ? 3600 / avgSpeed : null;

  const segments = (xml.match(/<trkseg\b/giu) ?? []).length;
  notes.push(
    'Read ' +
      points.length +
      ' point(s)' +
      (segments > 1 ? ' from ' + segments + ' track segments' : '') +
      '.',
  );
  if (threshold > 0) {
    notes.push('Elevation changes under ' + threshold + ' m were ignored as noise.');
  }
  if (elevations.length < points.length) {
    warnings.push('Some points have no <ele> value; gain and loss use only the points that do.');
  }
  if (duration === null) {
    notes.push('No usable <time> values, so duration, speed and pace are unavailable.');
  }
  if (points.length === 1) {
    notes.push('A single point has no distance.');
  }

  const stats: Record<string, string | number> = {
    points: points.length,
    distance: formatDistance(totalKm, imperial),
    elevationGain: elevations.length > 0 ? formatElevation(gain, imperial) : 'n/a',
    elevationLoss: elevations.length > 0 ? formatElevation(loss, imperial) : 'n/a',
    duration: duration === null ? 'n/a' : formatDuration(duration),
    avgSpeed: avgSpeed === null ? 'n/a' : formatSpeed(avgSpeed, imperial),
  };

  if (splitChoice === 'km' || splitChoice === 'mi') {
    const splitKm = splitChoice === 'km' ? 1 : KM_PER_MILE;
    const groups = buildSplits(vertices, splitKm);
    const rows: string[][] = groups.map((group, index) => {
      const first = group[0];
      const last = group[group.length - 1];
      const distance = first !== undefined && last !== undefined ? last.cum - first.cum : 0;
      const groupElevations = elevationsOf(group);
      const groupGainLoss = gainLoss(groupElevations, threshold);
      const groupDuration =
        first !== undefined && last !== undefined && first.time !== null && last.time !== null
          ? Math.max(0, (last.time - first.time) / 1000)
          : null;
      const speed =
        groupDuration !== null && groupDuration > 0 ? distance / (groupDuration / 3600) : null;
      return [
        'Split ' + (index + 1),
        formatDistance(distance, imperial),
        groupElevations.length > 0 ? formatElevation(groupGainLoss.gain, imperial) : 'n/a',
        groupElevations.length > 0 ? formatElevation(groupGainLoss.loss, imperial) : 'n/a',
        groupDuration === null ? 'n/a' : formatDuration(groupDuration),
        speed === null ? 'n/a' : formatSpeed(speed, imperial),
      ];
    });

    notes.push('Split length: 1 ' + (splitChoice === 'km' ? 'km' : 'mile') + '.');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Split', 'Distance', 'Elevation gain', 'Elevation loss', 'Duration', 'Avg speed'],
          rows,
        }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  const rows: string[][] = [
    ['Points', String(points.length)],
    ['Distance', formatDistance(totalKm, imperial)],
  ];
  if (elevations.length > 0) {
    rows.push(['Elevation gain', formatElevation(gain, imperial)]);
    rows.push(['Elevation loss', formatElevation(loss, imperial)]);
    if (minEle !== null) rows.push(['Min elevation', formatElevation(minEle, imperial)]);
    if (maxEle !== null) rows.push(['Max elevation', formatElevation(maxEle, imperial)]);
  }
  if (startTime !== null) rows.push(['Start', new Date(startTime).toISOString()]);
  if (endTime !== null) rows.push(['End', new Date(endTime).toISOString()]);
  rows.push(['Duration', duration === null ? 'n/a' : formatDuration(duration)]);
  rows.push(['Avg speed', avgSpeed === null ? 'n/a' : formatSpeed(avgSpeed, imperial)]);
  if (paceSeconds !== null) {
    rows.push([
      'Avg pace',
      formatPace(imperial ? paceSeconds * KM_PER_MILE : paceSeconds, imperial ? 'mi' : 'km'),
    ]);
  }
  if (lats.length > 0) {
    rows.push(['Bounds (lat)', Math.min(...lats) + ' to ' + Math.max(...lats)]);
    rows.push(['Bounds (lon)', Math.min(...lons) + ' to ' + Math.max(...lons)]);
  }

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Metric', 'Value'], rows }),
      render: 'table',
    },
    notes,
    warnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
