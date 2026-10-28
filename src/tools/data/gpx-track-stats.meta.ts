import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gpx-track-stats',
  name: 'GPX Track Stats',
  category: 'data',
  summary: 'Summarize a GPX track: distance, elevation gain and loss, duration, speed and splits.',
  description:
    'Drop in a GPX file from a watch, phone or ride-sharing app and get the numbers that matter: total distance, elevation gain and loss, minimum and maximum elevation, start and end time, duration, average speed and pace, plus an optional split table per kilometre or mile. Parsing happens entirely on your device.',
  keywords: [
    'gpx',
    'gpx viewer',
    'track stats',
    'elevation gain',
    'gps track',
    'running splits',
    'ride statistics',
    'distance calculator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.gpx,application/gpx+xml,text/xml',
  acceptsText: true,
  options: [
    {
      key: 'units',
      label: 'Units',
      type: 'select',
      choices: [
        { value: 'metric', label: 'Metric (km, m)' },
        { value: 'imperial', label: 'Imperial (mi, ft)' },
      ],
      default: 'metric',
    },
    {
      key: 'splits',
      label: 'Split table',
      type: 'select',
      choices: [
        { value: 'off', label: 'Off (summary only)' },
        { value: 'km', label: 'Per kilometre' },
        { value: 'mi', label: 'Per mile' },
      ],
      default: 'off',
    },
    {
      key: 'eleThreshold',
      label: 'Elevation noise threshold (m)',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    {
      title: 'A short three point track',
      input:
        '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="0" lon="0"><ele>100</ele><time>2024-01-01T00:00:00Z</time></trkpt><trkpt lat="0" lon="0.001"><ele>110</ele><time>2024-01-01T00:01:00Z</time></trkpt><trkpt lat="0" lon="0.002"><ele>105</ele><time>2024-01-01T00:02:00Z</time></trkpt></trkseg></trk></gpx>',
    },
    {
      title: 'Per-kilometre splits, imperial units',
      input:
        '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="40.7" lon="-74.0"><ele>10</ele><time>2024-06-01T08:00:00Z</time></trkpt><trkpt lat="40.71" lon="-74.01"><ele>12</ele><time>2024-06-01T08:05:00Z</time></trkpt><trkpt lat="40.72" lon="-74.02"><ele>11</ele><time>2024-06-01T08:10:00Z</time></trkpt></trkseg></trk></gpx>',
      options: { splits: 'km', units: 'imperial' },
    },
    {
      title: 'Quiet a jittery barometer',
      input:
        '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="51.5" lon="-0.12"><ele>30</ele><time>2024-03-15T10:00:00Z</time></trkpt><trkpt lat="51.5001" lon="-0.1201"><ele>31</ele><time>2024-03-15T10:00:30Z</time></trkpt><trkpt lat="51.5002" lon="-0.1202"><ele>32</ele><time>2024-03-15T10:01:00Z</time></trkpt></trkseg></trk></gpx>',
      options: { eleThreshold: 2 },
    },
  ],
  related: ['binary-file-signature', 'file-metadata', 'unit-convert', 'statistics-calculator'],
  status: 'stable',
};
