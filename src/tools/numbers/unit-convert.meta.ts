import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'unit-convert',
  name: 'Unit Converter',
  category: 'numbers',
  summary: 'Convert between units of length, mass, temperature, data and more.',
  description:
    'Convert a value between the units of a category — length, mass, temperature, volume, area, speed, data storage, time, pressure, energy or angle — and see the result expressed in every unit at once.',
  keywords: [
    'unit converter',
    'convert units',
    'length',
    'mass',
    'temperature',
    'kilometers to miles',
    'celsius to fahrenheit',
    'gib to mib',
    'measurement',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      default: 'length',
      choices: [
        { value: 'length', label: 'Length' },
        { value: 'mass', label: 'Mass' },
        { value: 'temperature', label: 'Temperature' },
        { value: 'volume', label: 'Volume' },
        { value: 'area', label: 'Area' },
        { value: 'speed', label: 'Speed' },
        { value: 'data-storage', label: 'Data storage' },
        { value: 'time', label: 'Time' },
        { value: 'pressure', label: 'Pressure' },
        { value: 'energy', label: 'Energy' },
        { value: 'angle', label: 'Angle' },
      ],
    },
    { key: 'from', label: 'From unit', type: 'text', default: '', placeholder: 'e.g. km' },
    { key: 'to', label: 'To unit', type: 'text', default: '', placeholder: 'e.g. mi' },
  ],
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
  examples: [
    {
      title: 'Kilometres to miles',
      input: '1',
      options: { category: 'length', from: 'km', to: 'mi' },
    },
    {
      title: 'Boiling point',
      input: '100',
      options: { category: 'temperature', from: 'C', to: 'F' },
    },
    {
      title: 'Gibibytes to mebibytes',
      input: '1',
      options: { category: 'data-storage', from: 'GiB', to: 'MiB' },
    },
    {
      title: 'Pressure in atmospheres',
      input: '1',
      options: { category: 'pressure', from: 'atm', to: 'Pa' },
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
  ],
  related: ['css-units', 'data-size', 'significant-figures'],
  status: 'stable',
};
