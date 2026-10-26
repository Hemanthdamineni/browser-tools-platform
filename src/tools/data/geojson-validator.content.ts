/**
 * Editorial content for the geojson-validator tool page.
 *
 * Kept out of ``geojson-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it checks and how it reports',
      body: 'The document is walked structure by structure and every problem is reported with a JSON path. Errors break an RFC 7946 requirement; warnings are advisory, such as a longitude past ±180. A document is valid when it has zero errors, and the summary shows feature and geometry counts plus the computed bounding box.',
    },
    {
      heading: 'The geometry rules that matter most',
      body: 'A polygon ring must close — first and last positions identical — and hold at least four positions; a LineString needs two or more; coordinates must nest to the right depth for the type. Unclosed rings and single-point lines are the two mistakes that silently corrupt a map, and both are caught.',
    },
    {
      heading: 'The format output options',
      body: 'Summary gives the verdict and counts. Problems found lists every error and warning with its path. Feature table turns each feature into a row so you can scan properties, geometry type and coordinates. Turning off strict mode keeps the structural checks but drops the RFC requirements some producers bend.',
    },
    {
      heading: 'What it deliberately leaves alone',
      body: 'Ring closure and minimum positions are checked, but self intersections, overlapping rings and winding order are not — those need a full geometry engine. The declared bbox is validated for shape and order but never trusted over the computed box; both are shown. Foreign members are kept and ignored, as RFC 7946 allows.',
    },
    {
      heading: 'The file never leaves your browser',
      body: 'Whether you pick a file or paste the JSON, the parse and the checks run in this tab. Up to 20 MB is accepted and the issue list is capped at 200 so a very broken document still finishes quickly. Nothing is uploaded.',
    },
  ],
  faq: [
    {
      q: 'What counts as invalid?',
      a: 'Two levels are reported. Errors are breaks of an RFC 7946 requirement, such as an unclosed polygon ring or a LineString with fewer than two positions. Warnings are advisory, such as a longitude outside plus or minus 180 or a deprecated crs member. A document is valid when it has no errors.',
    },
    {
      q: 'Does it check that geometry is topologically sound?',
      a: 'No. Ring closure and minimum position counts are checked, but self intersections, overlapping rings and winding order are not. That needs a full geometry engine, which this tool deliberately does not include.',
    },
    {
      q: 'Which is right, my bbox or the computed one?',
      a: 'Both are reported. The declared bbox is the one in your document, with its order checked; the computed bbox is derived from the actual coordinates, so a mismatch tells you the declared box is stale.',
    },
    {
      q: 'Are custom properties allowed?',
      a: 'Yes. RFC 7946 permits foreign members, so extra keys are kept and ignored. Only structural members are validated, and unknown values inside properties are never inspected.',
    },
  ],
} as const;
