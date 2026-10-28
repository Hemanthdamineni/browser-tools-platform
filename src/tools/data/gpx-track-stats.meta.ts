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
      max: 100,
    },
  ],
  examples: [
    {
      title: 'A short three point track',
      input:
        '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="0" lon="0"><ele>100</ele><time>2024-01-01T00:00:00Z</time></trkpt><trkpt lat="0" lon="0.001"><ele>110</ele><time>2024-01-01T00:01:00Z</time></trkpt><trkpt lat="0" lon="0.002"><ele>105</ele><time>2024-01-01T00:02:00Z</time></trkpt></trkseg></trk></gpx>',
    },
  ],
  faq: [
    {
      q: 'Which GPX point types are read?',
      a: 'Track points (trkpt) and route points (rtept), including self-closing tags. Multiple track segments are joined in order, so a paused recording still reads as one track.',
    },
    {
      q: 'How is distance calculated?',
      a: 'Each pair of consecutive points is measured with the haversine formula on a sphere of radius 6371.0088 km. That is accurate to well under one percent for normal GPS tracks, though it ignores changes in elevation.',
    },
    {
      q: 'Why would I set an elevation noise threshold?',
      a: 'Barometric and GPS altitude jitters by a metre or two, and adding up every wobble inflates elevation gain. Setting a threshold of 1 to 3 metres ignores changes smaller than that, which is what most analysis tools do.',
    },
    {
      q: 'What happens to tracks without timestamps?',
      a: 'Distance and elevation still work. Duration, speed and pace are shown as n/a because they need the time elements.',
    },
  ],
  related: [  "binary-file-signature",
  "file-metadata",
  "unit-convert",
  "statistics-calculator"],
  status: 'stable',
};
