import { describe, expect, it } from 'vitest';
import tool from './geojson-validator.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

const table = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(text, options);
  return { r, parsed: JSON.parse(r.report?.output ?? '{}') as Table };
};

const summary = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const { r, parsed } = await table(text, { ...options, format: 'summary' });
  const map: Record<string, string> = {};
  for (const row of parsed.rows) {
    const key = row[0];
    const value = row[1];
    if (key !== undefined && value !== undefined) map[key] = value;
  }
  return { r, map };
};

const issues = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const { r, parsed } = await table(text, { ...options, format: 'issues' });
  return { r, rows: parsed.rows, problems: parsed.rows.map((row) => row[2]), paths: parsed.rows.map((row) => row[0]) };
};

const POINT = '{"type":"Point","coordinates":[13.4,52.5]}';
const CLOSED_RING = '[[0,0],[1,0],[1,1],[0,0]]';

describe('geojson-validator', () => {
  it('accepts a valid Point and reports its computed bbox', async () => {
    const { r, map } = await summary(POINT);
    expect(map.Type).toBe('Point');
    expect(map.Status).toBe('valid');
    expect(map['Computed bbox']).toBe('13.4, 52.5, 13.4, 52.5');
    expect(map.Errors).toBe('0');
    expect(r.stats?.valid).toBe('yes');
    expect(r.stats?.positions).toBe(1);
  });

  it('summarizes a FeatureCollection', async () => {
    const doc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Point', coordinates: [13.4, 52.5] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [JSON.parse(CLOSED_RING)] } },
      ],
    });
    const { r, map } = await summary(doc);
    expect(map.Features).toBe('2');
    expect(map.Geometries).toBe('2');
    expect(map['Geometry types']).toBe('Point 1, Polygon 1');
    expect(map.Positions).toBe('5');
    expect(map.Status).toBe('valid');
    expect(r.stats?.features).toBe(2);
  });

  it('flags an unclosed polygon ring', async () => {
    const doc = '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}';
    const { r, problems, paths } = await issues(doc);
    expect(problems).toContain('Ring is not closed');
    expect(paths).toContain('$.coordinates[0]');
    expect((await summary(doc)).map.Status).toBe('invalid');
    expect(r.warnings?.join(' ')).toMatch(/1 RFC 7946 requirement\(s\) failed/i);
  });

  it('flags a ring with too few positions', async () => {
    const doc = '{"type":"Polygon","coordinates":[[[0,0],[1,0],[0,0]]]}';
    const { problems } = await issues(doc);
    expect(problems).toContain('Ring has too few positions');
    expect(problems).not.toContain('Ring is not closed');
  });

  it('flags a LineString with a single position', async () => {
    const doc = '{"type":"LineString","coordinates":[[0,0]]}';
    const { problems, paths } = await issues(doc);
    expect(problems).toContain('LineString is too short');
    expect(paths).toContain('$.coordinates');
  });

  it('checks every line of a MultiLineString', async () => {
    const doc = '{"type":"MultiLineString","coordinates":[[[0,0],[1,1]],[[2,2]]]}';
    const { problems, paths } = await issues(doc);
    expect(problems).toContain('LineString is too short');
    expect(paths).toContain('$.coordinates[1]');
  });

  it('checks every ring of a MultiPolygon at the right path', async () => {
    const good = await summary('{"type":"MultiPolygon","coordinates":[[' + CLOSED_RING + ']]}');
    expect(good.map.Status).toBe('valid');

    const bad = '{"type":"MultiPolygon","coordinates":[[ ' + CLOSED_RING + '],[[[0,0],[1,0],[1,1],[0,1]]]]}';
    const { problems, paths } = await issues(bad);
    expect(problems).toContain('Ring is not closed');
    expect(paths).toContain('$.coordinates[1][0]');
  });

  it('warns about a polygon with no rings but stays valid', async () => {
    const doc = '{"type":"Polygon","coordinates":[]}';
    const { r, rows, problems } = await issues(doc);
    expect(problems).toContain('Polygon has no rings');
    expect(rows[0]?.[1]).toBe('warning');
    expect(r.stats?.valid).toBe('yes');
    expect(r.stats?.errors).toBe(0);
  });

  it('rejects malformed positions and wrong nesting', async () => {
    const short = await issues('{"type":"LineString","coordinates":[[0,0],[1]]}');
    expect(short.problems).toContain('Invalid position');
    expect(short.paths).toContain('$.coordinates[1]');

    const nested = await issues('{"type":"Point","coordinates":[[0,0]]}');
    expect(nested.problems).toContain('Invalid position');
  });

  it('warns about out of range coordinates and extra values', async () => {
    const { r, rows } = await issues('{"type":"Point","coordinates":[200,95,3,4]}');
    const problems = rows.map((row) => row[2]);
    expect(problems).toContain('Longitude out of range');
    expect(problems).toContain('Latitude out of range');
    expect(problems).toContain('Extra position values');
    expect(r.stats?.valid).toBe('yes');
    expect(r.stats?.warnings).toBe(3);
  });

  it('warns about the deprecated crs member only in strict mode', async () => {
    const doc = '{"type":"Point","coordinates":[0,0],"crs":{"type":"name","properties":{"name":"EPSG:4326"}}}';
    expect((await issues(doc)).problems).toContain('Deprecated crs member');
    expect((await issues(doc, { strict: false })).problems).not.toContain('Deprecated crs member');
  });

  it('skips RFC requirement checks when strict is off', async () => {
    const doc = '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}';
    const { r, rows } = await issues(doc, { strict: false });
    expect(rows[0]?.[2]).toBe('No problems found');
    expect(r.stats?.valid).toBe('yes');
    expect(r.notes?.join(' ')).toMatch(/structurally/i);
  });

  it('validates the declared bbox', async () => {
    const { map } = await summary('{"type":"Point","coordinates":[0,0],"bbox":[0,0,0,0]}');
    expect(map['Declared bbox']).toBe('0, 0, 0, 0');

    expect((await issues('{"type":"Point","coordinates":[0,0],"bbox":[0,0,0]}')).problems).toContain(
      'Invalid bbox',
    );
    expect(
      (await issues('{"type":"Point","coordinates":[0,0],"bbox":[5,0,1,1]}')).problems,
    ).toContain('bbox minimum exceeds maximum');
  });

  it('validates Feature members', async () => {
    expect((await issues('{"type":"Feature","properties":{}}')).problems).toContain(
      'Missing geometry member',
    );
    const nullGeometry = await issues('{"type":"Feature","geometry":null,"properties":null}');
    expect(nullGeometry.rows[0]?.[1]).toBe('ok');

    expect(
      (await issues('{"type":"Feature","geometry":null}')).problems,
    ).toContain('Missing properties member');
    expect(
      (await issues('{"type":"Feature","geometry":null,"properties":[1]}')).problems,
    ).toContain('Invalid properties member');
    expect(
      (await issues('{"type":"Feature","geometry":null,"properties":null,"id":{}}')).problems,
    ).toContain('Unusual Feature id');
  });

  it('validates FeatureCollection structure', async () => {
    expect((await issues('{"type":"FeatureCollection"}')).problems).toContain('Missing features array');
    const { problems, paths } = await issues(
      '{"type":"FeatureCollection","features":[{"type":"Point","coordinates":[0,0]}]}',
    );
    expect(problems).toContain('Not a Feature');
    expect(paths).toContain('$.features[0]');
  });

  it('validates GeometryCollection structure', async () => {
    expect(
      (await issues('{"type":"GeometryCollection","coordinates":[],"geometries":[]}')).problems,
    ).toContain('Unexpected coordinates member');
    expect((await issues('{"type":"GeometryCollection"}')).problems).toContain(
      'Missing geometries array',
    );
    const nested = await summary(
      '{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[1,2]},{"type":"GeometryCollection","geometries":[]}]}',
    );
    expect(nested.map.Status).toBe('valid');
    expect(nested.map.Geometries).toBe('1');
  });

  it('rejects unknown types and non-object roots', async () => {
    expect((await issues('{"type":"Circle","coordinates":[0,0]}')).problems).toContain(
      'Unknown GeoJSON type',
    );
    expect((await issues('{"coordinates":[0,0]}')).problems).toContain('Missing type member');
    const arrayRoot = await issues('[1,2]');
    expect(arrayRoot.problems).toContain('Not a JSON object');
    expect(arrayRoot.paths).toContain('$');
  });

  it('reports one row per feature in the feature table', async () => {
    const doc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'a', properties: { x: 1, y: 2 }, geometry: { type: 'Point', coordinates: [1, 2] } },
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: [[0, 0], [1, 1]] } },
      ],
    });
    const { parsed } = await table(doc, { format: 'features' });
    expect(parsed.headers).toEqual(['#', 'Id', 'Geometry', 'Positions', 'BBox', 'Property keys']);
    expect(parsed.rows[0]).toEqual(['0', 'a', 'Point', '1', '1, 2, 1, 2', '2']);
    expect(parsed.rows[1]?.[2]).toBe('MultiPoint');
    expect(parsed.rows[1]?.[3]).toBe('2');
    expect(parsed.rows[1]?.[5]).toBe('0');
  });

  it('caps the issue list and says so', async () => {
    const features = Array.from({ length: 250 }, () => ({ type: 'Feature', properties: {} }));
    const { r } = await issues(JSON.stringify({ type: 'FeatureCollection', features }));
    expect(r.stats?.errors).toBe(250);
    expect(r.notes?.join(' ')).toMatch(/capped at 200/i);
  });

  it('reads the same document from a File', async () => {
    const file = new File([POINT], 'point.geojson', { type: 'application/geo+json' });
    const r = (await tool.run({ files: [file], options: {} })) as Result;
    expect(r.stats?.valid).toBe('yes');
    expect(r.report?.render).toBe('table');
  });

  it('rejects empty input and invalid JSON', async () => {
    await expect(run('')).rejects.toThrow(/choose a geojson file or paste/i);
    await expect(run('{oops')).rejects.toThrow(/not valid json/i);
  });
});
