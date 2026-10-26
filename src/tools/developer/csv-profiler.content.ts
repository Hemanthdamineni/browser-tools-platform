/**
 * Editorial content for the csv-profiler tool page.
 *
 * Kept out of ``csv-profiler.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The report you get back',
      body: 'Paste a delimited table and the profiler returns one row per column: its name, an inferred type, the number of data rows, how many cells are missing, how many values are unique, and, for numeric columns, the minimum, maximum and mean. It is a shape summary, not a rewrite; the original data is not changed.',
    },
    {
      heading: 'A first look before you trust a dataset',
      body: 'Run a file through this before loading it anywhere: the missing count shows where blanks hide, the unique count reveals whether an id column is really a key, a column typed string that should be numeric points at a stray value, and the range catches outliers early.',
    },
    {
      heading: 'The delimiter and numeric toggles',
      body: 'Column delimiter selects comma, tab, semicolon or pipe, so a tab-separated log or a European semicolon export profiles correctly. Show numeric stats decides whether the min, max and mean columns appear at all, which is handy when you only care about completeness and cardinality.',
    },
    {
      heading: 'How the numbers are worked out',
      body: 'A column is boolean only when every non-empty value is true or false, integer when every value matches a whole number, number when they all parse as finite numbers, and string otherwise; an entirely empty column shows the empty type. The header row is not profiled, missing cells are counted over data rows only, and the mean is rounded to two decimals. Rows with fewer fields are padded and extra fields are ignored.',
    },
    {
      heading: 'Profiled on device',
      body: 'The file is parsed and summarised inside the browser. Nothing is uploaded and no server is contacted, so confidential datasets can be inspected without them leaving the machine.',
    },
  ],
  faq: [
    {
      q: 'How is each column typed?',
      a: 'The profiler looks at the non-empty values in a column. If every value is only true/false it is boolean; integers only it is integer; a mix that parses as finite numbers it is number; otherwise it is string. Empty columns show an empty type.',
    },
    {
      q: 'What counts as a missing value?',
      a: 'A cell whose trimmed content is empty (including a completely empty cell). The header row is not profiled. Missing counts are over the data rows only.',
    },
    {
      q: 'How are min/max/mean computed?',
      a: 'For integer and number columns, from the numeric values after ignoring empty cells. The mean is rounded to two decimals. Toggle parseNumbers off to hide this and keep the report focused on counts.',
    },
    {
      q: 'Does it handle quoted fields and delimiters inside cells?',
      a: 'Yes. The parser follows RFC 4180: fields wrapped in double quotes can contain the delimiter and newlines, and doubled quotes inside a field are unescaped. Rows with fewer fields than the header are padded; extra fields are ignored.',
    },
  ],
} as const;
