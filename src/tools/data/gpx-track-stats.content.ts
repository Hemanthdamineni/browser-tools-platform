/**
 * Editorial content for the gpx-track-stats tool page.
 *
 * Kept out of ``gpx-track-stats.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The numbers extracted from a GPX file',
      body: 'A GPX file is parsed on-device for trkpt and rtept points, and each point is chained with a running distance. Distance uses the haversine formula on a 6371.0088 km sphere, while elevation gain and loss sum only the metre changes that clear a configurable noise threshold. With timestamps, duration, average speed and pace follow.',
    },
    {
      heading: 'When the summary tells you the story',
      body: 'Drop in a ride, run or hike exported from a watch, phone or ride-sharing app to see how far you went and how much climbing it packed without opening a mapping tool. The split table is the useful part for interval sessions: each row carries distance, gain, loss, duration and speed, with boundaries interpolated so a full split really is one kilometre of track.',
    },
    {
      heading: 'What the options change',
      body: 'Units toggles the whole report between metric (km, m) and imperial (mi, ft, mph), and the split table can be off, per kilometre, or per mile. The elevation noise threshold, in metres, drops every change smaller than its value from gain and loss, which counters barometric jitter; leave it at 0 to count every metre exactly.',
    },
    {
      heading: 'Edge cases to keep in mind',
      body: 'Points without an ele value are ignored for elevation, and a track with no usable time still reports distance and elevation but shows n/a for duration, speed and pace. A single point has no distance. Files over 25 MB are rejected, and a missing gpx root only raises a warning.',
    },
    {
      heading: 'Parsing happens on your device',
      body: 'The XML is read and every figure is computed in this tab, so a track from your device never leaves the browser and nothing is uploaded.',
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
} as const;
