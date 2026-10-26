import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'geojson-validator',
  name: 'GeoJSON Validator',
  category: 'data',
  summary: 'Validate GeoJSON against RFC 7946 and inspect features, rings and bounds.',
  description:
    'Check a GeoJSON document against RFC 7946 and see exactly what is wrong, with a JSON path for every problem. Catches unclosed polygon rings, rings with too few positions, LineStrings with a single point, wrong coordinate nesting, out of range longitudes and latitudes, misplaced bbox members and the long dead crs member. Also reports feature counts, geometry types and bounding boxes.',
  keywords: [
    'geojson',
    'geojson validator',
    'rfc 7946',
    'featurecollection',
    'polygon ring closure',
    'gis data',
    'map data check',
    'coordinates validation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.geojson,.json,application/geo+json,application/json',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'issues', label: 'Problems found' },
        { value: 'features', label: 'Feature table' },
      ],
      default: 'summary',
    },
    {
      key: 'strict',
      label: 'Enforce RFC 7946 requirements',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A valid two feature collection',
      input:
        '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"A"},"geometry":{"type":"Point","coordinates":[13.4,52.5]}},{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}]}',
    },
    {
      title: 'An unclosed polygon ring',
      input: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1]]]}',
    },
    {
      title: 'A LineString with a single point',
      input: '{"type":"LineString","coordinates":[[1,1]]}',
    },
  ],
  related: ['json-format', 'ndjson', 'gpx-track-stats', 'json-diff'],
  status: 'stable',
};
