import { describe, expect, it } from 'vitest';
import tool from './gpx-track-stats.tool';

type Report = { output: string; render?: string };
type Result = {
  outputs: unknown[];
  report?: Report;
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
  const { r, parsed } = await table(text, options);
  const map: Record<string, string> = {};
  for (const row of parsed.rows) {
    const key = row[0];
    const value = row[1];
    if (key !== undefined && value !== undefined) map[key] = value;
  }
  return { r, map };
};

const wrap = (body: string) =>
  '<?xml version="1.0"?>\n<gpx version="1.1" creator="test">\n' + body + '\n</gpx>';

/** Two 0.001 degree steps along the equator: 111.19 m each, 222.39 m in total. */
const SHORT = wrap(
  '<trk><name>T</name><trkseg>' +
    '<trkpt lat="0" lon="0"><ele>100</ele><time>2024-01-01T00:00:00Z</time></trkpt>' +
    '<trkpt lat="0" lon="0.001"><ele>110</ele><time>2024-01-01T00:01:00Z</time></trkpt>' +
    '<trkpt lat="0" lon="0.002"><ele>105</ele><time>2024-01-01T00:02:00Z</time></trkpt>' +
    '</trkseg></trk>',
);

/** Five points 0.01 degrees apart: 1.11195 km per step, 4.44780 km in total. */
const LONG = wrap(
  '<trk><trkseg>' +
    [0, 1, 2, 3, 4]
      .map(
        (i) =>
          '<trkpt lat="0" lon="' +
          (i * 0.01).toFixed(2) +
          '"><ele>' +
          (100 + i) +
          '</ele><time>2024-01-01T00:0' +
          i +
          ':00Z</time></trkpt>',
      )
      .join('') +
    '</trkseg></trk>',
);

describe('gpx-track-stats', () => {
  it('reports distance, elevation and duration for a short track', async () => {
    const { r, map } = await summary(SHORT);
    expect(r.outputs).toEqual([]);
    expect(r.report?.render).toBe('table');
    expect(map.Points).toBe('3');
    expect(map.Distance).toBe('222 m');
    expect(map['Elevation gain']).toBe('10 m');
    expect(map['Elevation loss']).toBe('5 m');
    expect(map['Min elevation']).toBe('100 m');
    expect(map['Max elevation']).toBe('110 m');
    expect(map.Duration).toBe('2m 0s');
    expect(r.stats?.points).toBe(3);
  });

  it('reports start and end timestamps', async () => {
    const { map } = await summary(SHORT);
    expect(map.Start).toBe('2024-01-01T00:00:00.000Z');
    expect(map.End).toBe('2024-01-01T00:02:00.000Z');
  });

  it('computes average speed and pace', async () => {
    const { map } = await summary(SHORT);
    expect(map['Avg speed']).toBe('6.67 km/h');
    expect(map['Avg pace']).toBe('9:00 /km');
  });

  it('reports the coordinate bounds', async () => {
    const { map } = await summary(SHORT);
    expect(map['Bounds (lat)']).toBe('0 to 0');
    expect(map['Bounds (lon)']).toBe('0 to 0.002');
  });

  it('converts to imperial units', async () => {
    const { map } = await summary(SHORT, { units: 'imperial' });
    expect(map.Distance).toBe('0.14 mi');
    expect(map['Elevation gain']).toBe('33 ft');
    expect(map['Avg speed']).toBe('4.15 mph');
    expect(map['Avg pace']).toBe('14:28 /mi');
  });

  it('ignores elevation changes below the noise threshold', async () => {
    const { map } = await summary(SHORT, { eleThreshold: 20 });
    expect(map['Elevation gain']).toBe('0 m');
    expect(map['Elevation loss']).toBe('0 m');
  });

  it('builds one split per kilometre with interpolated boundaries', async () => {
    const { r, parsed } = await table(LONG, { splits: 'km' });
    expect(parsed.headers[0]).toBe('Split');
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[0]?.[1]).toBe('1.00 km');
    expect(parsed.rows[1]?.[1]).toBe('1.00 km');
    expect(parsed.rows[4]?.[1]).toBe('448 m');
    expect(r.notes?.join(' ')).toMatch(/split length: 1 km/i);
    expect(r.stats?.points).toBe(5);
  });

  it('builds mile splits when asked', async () => {
    const { parsed } = await table(LONG, { splits: 'mi', units: 'imperial' });
    expect(parsed.headers[0]).toBe('Split');
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]?.[1]).toBe('1.00 mi');
    expect(parsed.rows[1]?.[1]).toBe('1.00 mi');
  });

  it('handles a track with no timestamps', async () => {
    const noTime = wrap(
      '<trk><trkseg><trkpt lat="0" lon="0"><ele>1</ele></trkpt>' +
        '<trkpt lat="0" lon="0.001"><ele>2</ele></trkpt></trkseg></trk>',
    );
    const { map, r } = await summary(noTime);
    expect(map.Distance).toBe('111 m');
    expect(map.Duration).toBe('n/a');
    expect(map['Avg speed']).toBe('n/a');
    expect(r.notes?.join(' ')).toMatch(/no usable <time>/i);
  });

  it('warns when some points lack elevation', async () => {
    const partial = wrap(
      '<trk><trkseg><trkpt lat="0" lon="0"><ele>1</ele></trkpt>' +
        '<trkpt lat="0" lon="0.001"></trkpt></trkseg></trk>',
    );
    const { r } = await summary(partial);
    expect(r.warnings?.join(' ')).toMatch(/no <ele> value/i);
  });

  it('reads self-closing and route points with either attribute order or quotes', async () => {
    const odd = wrap(
      '<rte>' +
        "<rtept lon='0' lat='0'/>" +
        '<rtept lon="0.001" lat="0"/><rtept lon="0.002" lat="0"/>' +
        '</rte>',
    );
    const { map } = await summary(odd);
    expect(map.Points).toBe('3');
    expect(map.Distance).toBe('222 m');
  });

  it('joins multiple track segments', async () => {
    const twoSegments = wrap(
      '<trk><trkseg><trkpt lat="0" lon="0"/></trkseg>' +
        '<trkseg><trkpt lat="0" lon="0.001"/><trkpt lat="0" lon="0.002"/></trkseg></trk>',
    );
    const { r, map } = await summary(twoSegments);
    expect(map.Points).toBe('3');
    expect(map.Distance).toBe('222 m');
    expect(r.notes?.join(' ')).toMatch(/2 track segments/i);
  });

  it('handles a single point without inventing distance', async () => {
    const single = wrap('<trk><trkseg><trkpt lat="10" lon="20"/></trkseg></trk>');
    const { r, map } = await summary(single);
    expect(map.Distance).toBe('0 m');
    expect(r.notes?.join(' ')).toMatch(/single point has no distance/i);
  });

  it('warns when the root element is not gpx', async () => {
    const notGpx =
      '<track><trkpt lat="0" lon="0"><ele>1</ele></trkpt><trkpt lat="0" lon="0.001"><ele>2</ele></trkpt></track>';
    const { r, map } = await summary(notGpx);
    expect(map.Points).toBe('2');
    expect(r.warnings?.join(' ')).toMatch(/no <gpx> root element/i);
  });

  it('reads the same content from a File', async () => {
    const file = new File([SHORT], 'track.gpx', { type: 'application/gpx+xml' });
    const result = (await tool.run({ files: [file], options: {} })) as Result;
    const parsed = JSON.parse(result.report?.output ?? '{}') as Table;
    expect(parsed.rows.some((row) => row[0] === 'Distance' && row[1] === '222 m')).toBe(true);
  });

  it('rejects a file with no track points', async () => {
    await expect(run(wrap('<metadata><name>empty</name></metadata>'))).rejects.toThrow(
      /no track points/i,
    );
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/choose a gpx file/i);
  });
});
