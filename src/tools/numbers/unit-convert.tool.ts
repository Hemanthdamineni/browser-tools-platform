import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { ToolError } from '@/lib/types';
import { meta } from './unit-convert.meta';

interface Unit {
  name: string;
  aliases: string[];
  factor: number; // value in the category's SI base unit per 1 of this unit
}

const U = (name: string, aliases: string[], factor: number): Unit => ({ name, aliases, factor });

const TABLE: Record<string, Unit[]> = {
  length: [
    U('millimetre', ['mm'], 0.001),
    U('centimetre', ['cm'], 0.01),
    U('metre', ['m', 'meter'], 1),
    U('kilometre', ['km'], 1000),
    U('inch', ['in', '"'], 0.0254),
    U('foot', ['ft', "'"], 0.3048),
    U('yard', ['yd'], 0.9144),
    U('mile', ['mi'], 1609.344),
    U('nautical mile', ['nmi'], 1852),
  ],
  mass: [
    U('milligram', ['mg'], 1e-6),
    U('gram', ['g'], 0.001),
    U('kilogram', ['kg'], 1),
    U('tonne', ['t', 'ton'], 1000),
    U('ounce', ['oz'], 0.028349523125),
    U('pound', ['lb', 'lbs'], 0.45359237),
    U('stone', ['st'], 6.35029318),
  ],
  volume: [
    U('millilitre', ['ml'], 0.001),
    U('litre', ['l', 'liter'], 1),
    U('cubic metre', ['m3', 'm³'], 1000),
    U('teaspoon (US)', ['tsp'], 0.00492892159375),
    U('tablespoon (US)', ['tbsp'], 0.01478676478125),
    U('fluid ounce (US)', ['fl oz', 'floz'], 0.0295735295625),
    U('cup (US)', ['cup'], 0.2365882365),
    U('pint (US)', ['pt'], 0.473176473),
    U('quart (US)', ['qt'], 0.946352946),
    U('gallon (US)', ['gal'], 3.785411784),
  ],
  area: [
    U('square millimetre', ['mm2', 'mm²'], 1e-6),
    U('square centimetre', ['cm2', 'cm²'], 1e-4),
    U('square metre', ['m2', 'm²'], 1),
    U('hectare', ['ha'], 10000),
    U('square kilometre', ['km2', 'km²'], 1e6),
    U('square inch', ['in2', 'in²', 'sq in'], 0.00064516),
    U('square foot', ['ft2', 'ft²', 'sq ft'], 0.09290304),
    U('square yard', ['yd2', 'yd²', 'sq yd'], 0.83612736),
    U('acre', ['ac'], 4046.8564224),
    U('square mile', ['mi2', 'mi²', 'sq mi'], 2589988.110336),
  ],
  speed: [
    U('metre per second', ['m/s', 'mps'], 1),
    U('kilometre per hour', ['km/h', 'kph', 'kmh'], 1000 / 3600),
    U('mile per hour', ['mph'], 0.44704),
    U('foot per second', ['ft/s', 'fps'], 0.3048),
    U('knot', ['kn', 'kt'], 1852 / 3600),
  ],
  'data-storage': [
    U('bit', ['b'], 0.125),
    U('byte', ['B'], 1),
    U('kilobyte', ['KB'], 1000),
    U('kibibyte', ['KiB'], 1024),
    U('megabyte', ['MB'], 1e6),
    U('mebibyte', ['MiB'], 1024 ** 2),
    U('gigabyte', ['GB'], 1e9),
    U('gibibyte', ['GiB'], 1024 ** 3),
    U('terabyte', ['TB'], 1e12),
    U('tebibyte', ['TiB'], 1024 ** 4),
  ],
  time: [
    U('millisecond', ['ms'], 0.001),
    U('second', ['s', 'sec'], 1),
    U('minute', ['min'], 60),
    U('hour', ['h', 'hr'], 3600),
    U('day', ['d'], 86400),
    U('week', ['wk'], 604800),
    U('year', ['yr', 'y'], 31557600),
  ],
  pressure: [
    U('pascal', ['Pa'], 1),
    U('kilopascal', ['kPa'], 1000),
    U('megapascal', ['MPa'], 1e6),
    U('bar', ['bar'], 1e5),
    U('atmosphere', ['atm'], 101325),
    U('pound per square inch', ['psi'], 6894.757293168),
    U('torr', ['Torr', 'mmHg'], 133.32236842105263),
  ],
  energy: [
    U('joule', ['J'], 1),
    U('kilojoule', ['kJ'], 1000),
    U('calorie', ['cal'], 4.184),
    U('kilocalorie', ['kcal', 'Cal'], 4184),
    U('watt hour', ['Wh'], 3600),
    U('kilowatt hour', ['kWh'], 3.6e6),
    U('british thermal unit', ['BTU'], 1055.05585262),
    U('electronvolt', ['eV'], 1.602176634e-19),
  ],
  angle: [
    U('degree', ['deg', '°'], 0.017453292519943295),
    U('radian', ['rad'], 1),
    U('gradian', ['grad', 'gon'], 0.015707963267948967),
    U('turn', ['turn', 'rev'], 6.283185307179586),
    U('arcminute', ['arcmin', '′'], 0.017453292519943295 / 60),
    U('arcsecond', ['arcsec', '″'], 0.017453292519943295 / 3600),
  ],
};

const TEMP = ['C', 'F', 'K', 'R'];

function toTempUnit(token: string): string | undefined {
  const t = token.trim().toLowerCase();
  const map: Record<string, string> = {
    c: 'C',
    celsius: 'C',
    '°c': 'C',
    f: 'F',
    fahrenheit: 'F',
    '°f': 'F',
    k: 'K',
    kelvin: 'K',
    r: 'R',
    rankine: 'R',
    '°r': 'R',
  };
  return map[t];
}

function findUnit(category: string, token: string): Unit | undefined {
  const t = token.trim().toLowerCase();
  return TABLE[category]?.find(
    (u) => u.name.toLowerCase() === t || u.aliases.some((a) => a.toLowerCase() === t),
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) return n.toExponential(6).replace(/\.?0+e/, 'e');
  const s = Number(n.toPrecision(9)).toString();
  return s;
}

/** Temperature: convert to Kelvin, then out. */
function tempConvert(value: number, from: string, to: string): number {
  let k: number;
  if (from === 'C') k = value + 273.15;
  else if (from === 'F') k = ((value - 32) * 5) / 9 + 273.15;
  else if (from === 'R') k = (value * 5) / 9;
  else k = value;
  if (to === 'C') return k - 273.15;
  if (to === 'F') return ((k - 273.15) * 9) / 5 + 32;
  if (to === 'R') return (k * 9) / 5;
  return k;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const category = String(o.category);
  const text = input.text.trim();
  if (!text) return { output: '' };
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new ToolError(
      'Enter a numeric value.',
      'The input must be a plain number, e.g. 1 or 2.5',
    );
  }

  const fromToken = String(o.from).trim();
  const toToken = String(o.to).trim();
  if (!fromToken || !toToken) {
    throw new ToolError(
      'Choose both a from unit and a to unit.',
      'Enter unit symbols like km and mi.',
    );
  }

  if (category === 'temperature') {
    const from = toTempUnit(fromToken);
    const to = toTempUnit(toToken);
    if (!from || !to) {
      throw new ToolError(`Unknown temperature unit. Use one of: C, F, K, R.`);
    }
    const rows: string[][] = [['Value (C)', fmt(tempConvert(value, from, 'C'))]];
    for (const u of TEMP) rows.push([u, fmt(tempConvert(value, from, u))]);
    return {
      output: JSON.stringify({ headers: ['Unit', 'Value'], rows }),
      render: 'table',
      stats: { [`${from} → ${to}`]: fmt(tempConvert(value, from, to)) },
    };
  }

  const units = TABLE[category] ?? [];
  const from = findUnit(category, fromToken);
  const to = findUnit(category, toToken);
  if (!from || !to) {
    const valid = units.map((u) => u.aliases[0]).join(', ');
    throw new ToolError(`Unknown unit for ${category}.`, `Valid units: ${valid}`);
  }
  const base = value * from.factor;
  const rows: string[][] = [[to.name, fmt(base / to.factor)]];
  for (const u of units) rows.push([u.name, fmt(base / u.factor)]);
  return {
    output: JSON.stringify({ headers: ['Unit', 'Value'], rows }),
    render: 'table',
    stats: { [`${fromToken} → ${toToken}`]: fmt(base / to.factor) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
