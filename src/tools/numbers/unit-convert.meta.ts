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
  related: ['css-units', 'data-size', 'significant-figures'],
  status: 'stable',
};
