/**
 * Editorial content for the unit-convert tool page.
 *
 * Kept out of ``unit-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One value, every unit at once',
      body: 'Type a number, name a from-unit and a to-unit within a category, and the tool converts the value and shows the result expressed in every unit of that category. Length, mass, temperature, volume, area, speed, data storage, time, pressure, energy and angle are all available, so instead of answering one question it answers the same value in every alternative unit at the same time.',
    },
    {
      heading: 'When it is quicker than a search',
      body: 'A quick "how many miles is 5 km" or "what is 212 degrees in Celsius" is exactly the moment to use it — you type the number, pick the units and read the answer row. It also saves time when you need several conversions of one value, such as turning a single measurement into both the metric and imperial rows of a table.',
    },
    {
      heading: 'The unit aliases and the from/to fields',
      body: 'Units are matched by their short forms and common aliases: km, mi, m, ft, in, lb, kg, C, F, K, GB, GiB and many more are recognised, so you do not have to remember the exact spelling. If the from and to fields are left empty, the default first unit of the category is used; the result table shows every unit so the target row is easy to spot.',
    },
    {
      heading: 'How each category behaves',
      body: 'Most categories are a simple factor table against a single base unit, so one multiply-and-divide does the conversion. Temperature is the exception: values are converted to Kelvin first and then out to Celsius, Fahrenheit, Kelvin or Rankine, because the offset makes a plain factor wrong. Data storage supports both decimal (KB, MB, GB, 1000-based) and binary (KiB, MiB, GiB, 1024-based) prefixes so 1 GiB is 1024 MiB but 1 GB is 1000 MB.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'The value is converted with unit tables already built into the page. No number you type is uploaded and no unit data is fetched, so the conversion works offline and is safe for internal measurements.',
    },
  ],
  faq: [
    {
      q: 'Does the data-storage category use binary or decimal prefixes?',
      a: 'Both: KB/MB/GB are decimal (1000-based) and KiB/MiB/GiB are binary (1024-based), so 1 GiB = 1024 MiB but 1 GB = 1000 MB.',
    },
    {
      q: 'How is temperature handled?',
      a: 'Temperature is not a simple factor table — values are converted to Kelvin first, then out to Celsius, Fahrenheit, Kelvin or Rankine.',
    },
    {
      q: 'What happens if I leave the from or to unit blank?',
      a: 'Blank fields fall back to the first unit of the selected category, and the result table still shows the value in every unit of that category, so you can find the row you want without naming both units.',
    },
  ],
} as const;
