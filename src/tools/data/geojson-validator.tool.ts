import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './geojson-validator.meta';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ISSUES = 200;
const MAX_DEPTH = 12;

type Level = 'error' | 'warning';

interface Issue {
  path: string;
  level: Level;
  problem: string;
  detail: string;
}

interface State {
  issues: Issue[];
  positions: number[][];
  truncated: number;
  droppedErrors: number;
  droppedWarnings: number;
  depth: number;
  strict: boolean;
}

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function report(state: State, path: string, level: Level, problem: string, detail: string): void {
  if (state.issues.length >= MAX_ISSUES) {
    state.truncated += 1;
    if (level === 'error') state.droppedErrors += 1;
    else state.droppedWarnings += 1;
    return;
  }
  state.issues.push({ path, level, problem, detail });
}

function checkBbox(state: State, value: unknown, path: string): void {
  const valid =
    Array.isArray(value) &&
    (value.length === 4 || value.length === 6) &&
    value.every(isFiniteNumber);
  if (!valid) {
    report(state, path, 'error', 'Invalid bbox', 'A bbox must be an array of four or six numbers.');
    return;
  }
  if (!state.strict) return;
  const numbers = value as number[];
  const half = numbers.length / 2;
  for (let i = 0; i < half; i += 1) {
    const low = numbers[i] ?? 0;
    const high = numbers[i + half] ?? 0;
    if (low > high) {
      report(state, path, 'warning', 'bbox minimum exceeds maximum', 'Element ' + i + ' is ' + low + ' but element ' + (i + half) + ' is ' + high + '.');
    }
  }
}

function checkPosition(state: State, value: unknown, path: string): void {
  const valid =
    Array.isArray(value) && value.length >= 2 && value.every(isFiniteNumber);
  if (!valid) {
    report(state, path, 'error', 'Invalid position', 'A position must be an array of at least two numbers.');
    return;
  }
  const numbers = value as number[];
  state.positions.push(numbers);
  if (!state.strict) return;

  const lon = numbers[0] ?? 0;
  const lat = numbers[1] ?? 0;
  if (numbers.length > 3) {
    report(state, path, 'warning', 'Extra position values', 'RFC 7946 positions hold two or three numbers; this one has ' + numbers.length + '.');
  }
  if (lon < -180 || lon > 180) {
    report(state, path, 'warning', 'Longitude out of range', 'Longitude ' + lon + ' is outside -180 to 180.');
  }
  if (lat < -90 || lat > 90) {
    report(state, path, 'warning', 'Latitude out of range', 'Latitude ' + lat + ' is outside -90 to 90.');
  }
}

function samePosition(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function eachIn(
  state: State,
  value: unknown,
  path: string,
  what: string,
  visit: (child: unknown, childPath: string) => void,
): void {
  if (!Array.isArray(value)) {
    report(state, path, 'error', 'Expected an array', 'A ' + what + ' must be an array.');
    return;
  }
  const list = value as unknown[];
  for (let i = 0; i < list.length; i += 1) visit(list[i], path + '[' + i + ']');
}

function checkLine(state: State, value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    report(state, path, 'error', 'Expected an array', 'A LineString must be an array of positions.');
    return;
  }
  const list = value as unknown[];
  for (let i = 0; i < list.length; i += 1) checkPosition(state, list[i], path + '[' + i + ']');
  if (state.strict && list.length < 2) {
    report(state, path, 'error', 'LineString is too short', 'A LineString needs at least two positions; this has ' + list.length + '.');
  }
}

function checkRing(state: State, value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    report(state, path, 'error', 'Expected an array', 'A polygon ring must be an array of positions.');
    return;
  }
  const ring = value as unknown[];
  for (let i = 0; i < ring.length; i += 1) checkPosition(state, ring[i], path + '[' + i + ']');
  if (!state.strict) return;

  if (ring.length < 4) {
    report(state, path, 'error', 'Ring has too few positions', 'A linear ring needs at least four positions, counting the repeated first one; this has ' + ring.length + '.');
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    Array.isArray(first) &&
    Array.isArray(last) &&
    first.every(isFiniteNumber) &&
    last.every(isFiniteNumber) &&
    !samePosition(first as number[], last as number[])
  ) {
    report(state, path, 'error', 'Ring is not closed', 'The first and last positions of a linear ring must be identical.');
  }
}

function checkCoordinates(state: State, value: Record<string, unknown>, path: string): void {
  const type = String(value.type);
  const coordinatesPath = path + '.coordinates';
  if (!('coordinates' in value)) {
    report(state, path, 'error', 'Missing coordinates member', 'A ' + type + ' geometry needs a coordinates member.');
    return;
  }
  const coordinates = value.coordinates;

  if (type === 'Point') {
    checkPosition(state, coordinates, coordinatesPath);
    return;
  }
  if (type === 'MultiPoint') {
    eachIn(state, coordinates, coordinatesPath, 'MultiPoint', (child, childPath) => {
      checkPosition(state, child, childPath);
    });
    return;
  }
  if (type === 'LineString') {
    checkLine(state, coordinates, coordinatesPath);
    return;
  }
  if (type === 'MultiLineString') {
    eachIn(state, coordinates, coordinatesPath, 'MultiLineString', (child, childPath) => {
      checkLine(state, child, childPath);
    });
    return;
  }
  if (type === 'Polygon') {
    if (Array.isArray(coordinates) && coordinates.length === 0) {
      report(state, coordinatesPath, 'warning', 'Polygon has no rings', 'A Polygon should have at least one ring.');
    }
    eachIn(state, coordinates, coordinatesPath, 'Polygon', (child, childPath) => {
      checkRing(state, child, childPath);
    });
    return;
  }
  // MultiPolygon
  eachIn(state, coordinates, coordinatesPath, 'MultiPolygon', (polygon, polygonPath) => {
    eachIn(state, polygon, polygonPath, 'Polygon', (ring, ringPath) => {
      checkRing(state, ring, ringPath);
    });
  });
}

function checkFeature(state: State, value: Record<string, unknown>, path: string): void {
  if (!('geometry' in value)) {
    report(state, path, 'error', 'Missing geometry member', 'A Feature must have a geometry member, which may be null.');
  } else if (value.geometry !== null) {
    state.depth += 1;
    checkValue(state, value.geometry, path + '.geometry');
    state.depth -= 1;
  }

  if (!('properties' in value)) {
    report(state, path, 'warning', 'Missing properties member', 'RFC 7946 expects a properties member; use null when there is nothing to store.');
  } else if (value.properties !== null && !isObject(value.properties)) {
    report(state, path, 'error', 'Invalid properties member', 'Feature properties must be an object or null.');
  }

  if ('id' in value && value.id !== null && typeof value.id !== 'string' && typeof value.id !== 'number') {
    report(state, path, 'warning', 'Unusual Feature id', 'A Feature id should be a string or a number.');
  }
}

function checkValue(state: State, value: unknown, path: string): void {
  if (state.depth > MAX_DEPTH) {
    report(state, path, 'error', 'Too deeply nested', 'Nesting deeper than ' + MAX_DEPTH + ' levels was not checked.');
    return;
  }
  if (!isObject(value)) {
    report(state, path, 'error', 'Not a JSON object', 'Every GeoJSON object must be a JSON object.');
    return;
  }
  const type = value.type;
  if (typeof type !== 'string') {
    report(state, path, 'error', 'Missing type member', 'A GeoJSON object needs a string type member.');
    return;
  }
  if (type !== 'Feature' && type !== 'FeatureCollection' && type !== 'GeometryCollection' && !GEOMETRY_TYPES.has(type)) {
    report(state, path, 'error', 'Unknown GeoJSON type', '"' + type + '" is not one of the GeoJSON types.');
    return;
  }
  if (state.strict && 'crs' in value) {
    report(state, path, 'warning', 'Deprecated crs member', 'RFC 7946 removed the crs member; positions are always WGS84 longitude then latitude.');
  }
  if ('bbox' in value) checkBbox(state, value.bbox, path + '.bbox');

  if (type === 'Feature') {
    checkFeature(state, value, path);
    return;
  }

  if (type === 'FeatureCollection') {
    if (!Array.isArray(value.features)) {
      report(state, path, 'error', 'Missing features array', 'A FeatureCollection needs a features member that is an array.');
      return;
    }
    const list = value.features as unknown[];
    for (let i = 0; i < list.length; i += 1) {
      const child = list[i];
      const childPath = path + '.features[' + i + ']';
      if (!isObject(child) || child.type !== 'Feature') {
        report(state, childPath, 'error', 'Not a Feature', 'Every entry of a FeatureCollection must be a Feature object.');
        continue;
      }
      state.depth += 1;
      checkValue(state, child, childPath);
      state.depth -= 1;
    }
    return;
  }

  if (type === 'GeometryCollection') {
    if ('coordinates' in value) {
      report(state, path, 'error', 'Unexpected coordinates member', 'A GeometryCollection uses geometries, not coordinates.');
    }
    if (!Array.isArray(value.geometries)) {
      report(state, path, 'error', 'Missing geometries array', 'A GeometryCollection needs a geometries member that is an array.');
      return;
    }
    const list = value.geometries as unknown[];
    for (let i = 0; i < list.length; i += 1) {
      state.depth += 1;
      checkValue(state, list[i], path + '.geometries[' + i + ']');
      state.depth -= 1;
    }
    return;
  }

  if ('geometries' in value) {
    report(state, path, 'warning', 'Unexpected geometries member', 'Only a GeometryCollection uses a geometries member.');
  }
  checkCoordinates(state, value, path);
}

/* ------------------------------- statistics ------------------------------- */

function walkPositions(value: unknown, out: number[][]): void {
  if (Array.isArray(value) && value.length >= 2 && value.every(isFiniteNumber)) {
    out.push(value as number[]);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) walkPositions(child, out);
  }
}

function collectPositions(value: unknown, out: number[][], depth = 0): void {
  if (depth > MAX_DEPTH || !isObject(value)) return;
  const type = value.type;
  if (type === 'FeatureCollection' && Array.isArray(value.features)) {
    for (const feature of value.features) collectPositions(feature, out, depth + 1);
    return;
  }
  if (type === 'Feature') {
    if (value.geometry !== null && value.geometry !== undefined) {
      collectPositions(value.geometry, out, depth + 1);
    }
    return;
  }
  if (type === 'GeometryCollection' && Array.isArray(value.geometries)) {
    for (const geometry of value.geometries) collectPositions(geometry, out, depth + 1);
    return;
  }
  if ('coordinates' in value) walkPositions(value.coordinates, out);
}

interface DocStats {
  features: number;
  geometries: number;
  byType: Map<string, number>;
}

function walkStats(value: unknown, stats: DocStats, depth = 0): void {
  if (depth > MAX_DEPTH || !isObject(value)) return;
  const type = value.type;
  if (type === 'FeatureCollection' && Array.isArray(value.features)) {
    for (const feature of value.features) walkStats(feature, stats, depth + 1);
    return;
  }
  if (type === 'Feature') {
    stats.features += 1;
    if (value.geometry !== null && value.geometry !== undefined) {
      walkStats(value.geometry, stats, depth + 1);
    }
    return;
  }
  if (type === 'GeometryCollection' && Array.isArray(value.geometries)) {
    for (const geometry of value.geometries) walkStats(geometry, stats, depth + 1);
    return;
  }
  if (typeof type === 'string' && GEOMETRY_TYPES.has(type)) {
    stats.geometries += 1;
    stats.byType.set(type, (stats.byType.get(type) ?? 0) + 1);
  }
}

function bboxOf(positions: number[][]): number[] | null {
  if (positions.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let hasAlt = false;
  for (const position of positions) {
    const lon = position[0] ?? 0;
    const lat = position[1] ?? 0;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    const alt = position[2];
    if (position.length > 2 && isFiniteNumber(alt)) {
      hasAlt = true;
      minAlt = Math.min(minAlt, alt);
      maxAlt = Math.max(maxAlt, alt);
    }
  }
  const box = [minLon, minLat, maxLon, maxLat];
  if (hasAlt) box.push(minAlt, maxAlt);
  return box.map((value) => Number(value.toFixed(6)));
}

const formatBbox = (box: number[] | null): string => (box === null ? 'n/a' : box.join(', '));

function featureRows(root: unknown): string[][] {
  const rows: string[][] = [];
  const add = (index: number, feature: Record<string, unknown>): void => {
    const positions: number[][] = [];
    collectPositions(feature, positions);
    const geometry = feature.geometry;
    const geometryType =
      isObject(geometry) && typeof geometry.type === 'string'
        ? geometry.type
        : geometry === null
          ? 'null'
          : 'unknown';
    const propertyCount = isObject(feature.properties) ? Object.keys(feature.properties).length : 0;
    rows.push([
      String(index),
      feature.id === undefined || feature.id === null ? '' : String(feature.id),
      geometryType,
      String(positions.length),
      formatBbox(bboxOf(positions)),
      String(propertyCount),
    ]);
  };

  if (isObject(root) && root.type === 'FeatureCollection' && Array.isArray(root.features)) {
    (root.features as unknown[]).forEach((feature, index) => {
      if (isObject(feature)) add(index, feature);
    });
    return rows;
  }
  if (isObject(root) && root.type === 'Feature') {
    add(0, root);
    return rows;
  }
  if (isObject(root)) {
    const positions: number[][] = [];
    collectPositions(root, positions);
    rows.push([
      '0',
      '',
      typeof root.type === 'string' ? root.type : 'unknown',
      String(positions.length),
      formatBbox(bboxOf(positions)),
      '',
    ]);
  }
  return rows;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'summary');
  const strict = o.strict !== false;

  const file = input.files[0];
  let text: string;
  if (file !== undefined) {
    if (file.size === 0) throw new ToolError('That file is empty.');
    if (file.size > MAX_BYTES) throw new ToolError('That file is larger than 20 MB.', 'Validate a smaller document.');
    text = await file.text();
  } else {
    text = String(input.text ?? '').trim();
  }
  if (text === '') {
    throw new ToolError('Choose a GeoJSON file or paste a document.', 'Both a file and pasted JSON work.');
  }
  if (text.length > MAX_BYTES) {
    throw new ToolError('That is more than 20 MB of JSON.', 'Validate a smaller document.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ToolError(
      'That is not valid JSON.',
      error instanceof Error ? error.message : 'The document could not be parsed.',
    );
  }

  const state: State = {
    issues: [],
    positions: [],
    truncated: 0,
    droppedErrors: 0,
    droppedWarnings: 0,
    depth: 0,
    strict,
  };
  checkValue(state, parsed, '$');

  const errors = state.issues.filter((issue) => issue.level === 'error').length;
  const warnings = state.issues.length - errors;
  const totalErrors = errors + state.droppedErrors;
  const totalWarnings = warnings + state.droppedWarnings;
  const valid = totalErrors === 0;

  const stats: DocStats = { features: 0, geometries: 0, byType: new Map() };
  walkStats(parsed, stats);
  const computed = bboxOf(state.positions);

  const notes: string[] = [];
  const resultWarnings: string[] = [];
  notes.push(
    'Checked ' +
      stats.features +
      ' feature(s) and ' +
      stats.geometries +
      ' geometr' +
      (stats.geometries === 1 ? 'y' : 'ies') +
      (strict ? ' against RFC 7946.' : ' structurally, without the RFC 7946 requirement checks.'),
  );
  if (state.truncated > 0) {
    notes.push('Issue list capped at ' + MAX_ISSUES + '; ' + state.truncated + ' more were not listed.');
  }
  if (!valid) {
    resultWarnings.push(totalErrors + ' RFC 7946 requirement(s) failed.');
  }

  const statsOut: Record<string, string | number> = {
    type: isObject(parsed) && typeof parsed.type === 'string' ? parsed.type : 'unknown',
    features: stats.features,
    geometries: stats.geometries,
    positions: state.positions.length,
    errors: totalErrors,
    warnings: totalWarnings,
    valid: valid ? 'yes' : 'no',
  };

  if (format === 'issues') {
    const rows =
      state.issues.length === 0
        ? [['$', 'ok', 'No problems found', 'The document satisfies the checks that were enabled.']]
        : state.issues.map((issue) => [issue.path, issue.level, issue.problem, issue.detail]);
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Path', 'Level', 'Problem', 'Detail'], rows }),
        render: 'table',
      },
      notes,
      warnings: resultWarnings,
      stats: statsOut,
    };
  }

  if (format === 'features') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Id', 'Geometry', 'Positions', 'BBox', 'Property keys'],
          rows: featureRows(parsed),
        }),
        render: 'table',
      },
      notes,
      warnings: resultWarnings,
      stats: statsOut,
    };
  }

  const typeBreakdown =
    stats.byType.size === 0
      ? 'none'
      : [...stats.byType.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([type, count]) => type + ' ' + count)
          .join(', ');

  const rows: string[][] = [
    ['Type', statsOut.type as string],
    ['Features', String(stats.features)],
    ['Geometries', String(stats.geometries)],
    ['Geometry types', typeBreakdown],
    ['Positions', String(state.positions.length)],
  ];
  if (isObject(parsed) && 'bbox' in parsed) {
    rows.push(['Declared bbox', Array.isArray(parsed.bbox) ? parsed.bbox.join(', ') : String(parsed.bbox)]);
  }
  rows.push(['Computed bbox', formatBbox(computed)]);
  rows.push(['Errors', String(totalErrors)]);
  rows.push(['Warnings', String(totalWarnings)]);
  rows.push(['Status', valid ? 'valid' : 'invalid']);

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows }),
      render: 'table',
    },
    notes,
    warnings: resultWarnings,
    stats: statsOut,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
