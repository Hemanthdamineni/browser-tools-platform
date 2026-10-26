/**
 * SIP calculator — the mutual-fund style monthly investment plan.
 *
 * The text box is decorative: the numbers live in the options, exactly like the
 * other calculators in this category. Everything below is pure — the maths is a
 * month-by-month simulation, the chart is a string of SVG, and nothing here
 * touches the DOM, the clock or the network.
 */
import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { escapeHtml } from '@/lib/format';
import { meta } from './sip-calculator.meta';

/* -------------------------------------------------------------------------- */
/*  Limits — guards against absurd inputs before a number can blow up          */
/* -------------------------------------------------------------------------- */

/** Largest projection we are willing to print (₹1,00,00,000 crore). */
const MAX_PROJECTED_VALUE = 1e13;
const MAX_SIP = 1e9;
const MAX_LUMPSUM = 1e13;
const MAX_YEARS = 100;
const MAX_MONTHS = 11;
const MAX_RATE_PERCENT = 100;
const MAX_STEP_UP_PERCENT = 100;

/* -------------------------------------------------------------------------- */
/*  Formatting — Indian numbering (lakh / crore)                              */
/* -------------------------------------------------------------------------- */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹11,61,695.38 */
export function formatINR(value: number): string {
  return inr.format(value);
}

/** Compact rupee label for chart axes: ₹1.2 L, ₹3.4 Cr. */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${trimZeros((abs / 1e7).toFixed(2))} Cr`;
  if (abs >= 1e5) return `${sign}₹${trimZeros((abs / 1e5).toFixed(2))} L`;
  if (abs >= 1000) return `${sign}₹${trimZeros((abs / 1000).toFixed(1))}K`;
  return `${sign}₹${trimZeros(abs.toFixed(2))}`;
}

function trimZeros(text: string): string {
  return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/* -------------------------------------------------------------------------- */
/*  Inputs                                                                    */
/* -------------------------------------------------------------------------- */

export interface SipInputs {
  /** Monthly instalment in ₹. */
  monthlySip: number;
  /** Percentage the instalment grows by, once a year. */
  stepUpPercent: number;
  /** Assumed annual return, in percent. */
  annualReturnPercent: number;
  /** Whole years of the plan. */
  years: number;
  /** Extra months (0–11) on top of the years. */
  months: number;
  /** One-time amount invested at the start. */
  lumpsum: number;
  /** When each instalment is invested inside its month. */
  timing: 'start' | 'end';
}

export interface GrowthPoint {
  /** Years elapsed at this milestone (fractional for a part-year). */
  year: number;
  /** Human label: "Year 5" or "10y 3m". */
  label: string;
  /** Everything paid in so far (lumpsum + instalments). */
  invested: number;
  /** Portfolio value at this milestone. */
  value: number;
  /** The monthly instalment in force during this year. */
  sip: number;
}

export interface SipProjection {
  /** Number of monthly instalments. */
  months: number;
  /** Monthly rate used by the simulation. */
  monthlyRate: number;
  totalInvested: number;
  estimatedValue: number;
  estimatedGain: number;
  points: GrowthPoint[];
}

function readNumber(value: unknown, label: string, min: number, max: number, unit = ''): number {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    n = Number(value.trim());
  } else {
    n = Number.NaN;
  }
  if (!Number.isFinite(n)) {
    throw new ToolError(`${label} must be a number.`, 'Enter digits only, for example 5000.');
  }
  if (n < min) {
    throw new ToolError(`${label} cannot be less than ${min}${unit}.`);
  }
  if (n > max) {
    throw new ToolError(`${label} cannot be more than ${max}${unit}.`);
  }
  return n;
}

/** Validate + normalise the option values into a plan. */
export function parseInputs(options: OptionValues): SipInputs {
  const monthlySip = readNumber(options.monthlySip, 'The monthly SIP amount', 0, MAX_SIP);
  const stepUpPercent = readNumber(
    options.stepUpPercent,
    'The annual step-up',
    0,
    MAX_STEP_UP_PERCENT,
    '%',
  );
  const annualReturnPercent = readNumber(
    options.annualReturnPercent,
    'The expected annual return',
    0,
    MAX_RATE_PERCENT,
    '%',
  );
  const years = Math.round(readNumber(options.years, 'The duration in years', 0, MAX_YEARS));
  const months = Math.round(readNumber(options.months, 'The extra months', 0, MAX_MONTHS));
  const lumpsum = readNumber(options.lumpsum, 'The one-time lumpsum', 0, MAX_LUMPSUM);

  const timing = String(options.timing) === 'end' ? 'end' : 'start';

  if (years * 12 + months <= 0) {
    throw new ToolError(
      'The investment duration must be at least one month.',
      'Set the duration in years to 1 or more.',
    );
  }
  if (monthlySip === 0 && lumpsum === 0) {
    throw new ToolError(
      'There is nothing to invest.',
      'Enter a monthly SIP amount, a one-time lumpsum, or both.',
    );
  }

  return { monthlySip, stepUpPercent, annualReturnPercent, years, months, lumpsum, timing };
}

/* -------------------------------------------------------------------------- */
/*  The engine                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Simulate the plan month by month.
 *
 * `timing: 'start'` — the instalment is invested at the start of its month, so
 * it also earns that month's growth (an annuity due). `timing: 'end'` — the
 * instalment is invested at the end of its month and earns from the next one
 * (an ordinary annuity). The start-of-month plan is worth exactly one extra
 * month of interest, so the two differ by a factor of (1 + monthlyRate).
 */
export function simulateSip(input: SipInputs): SipProjection {
  const months = input.years * 12 + input.months;
  const monthlyRate = input.annualReturnPercent / 100 / 12;
  const growth = 1 + monthlyRate;
  const step = input.stepUpPercent / 100;

  let balance = input.lumpsum;
  let invested = input.lumpsum;
  const points: GrowthPoint[] = [];

  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const sip = input.monthlySip * Math.pow(1 + step, yearIndex);

    balance = input.timing === 'start' ? (balance + sip) * growth : balance * growth + sip;
    invested += sip;

    if (!Number.isFinite(balance) || !Number.isFinite(invested)) {
      throw new ToolError(
        'These inputs project a value that is too large to calculate.',
        'Reduce the duration, the step-up or the expected return.',
      );
    }
    if (balance > MAX_PROJECTED_VALUE) {
      throw new ToolError(
        'These inputs project an unrealistically large value.',
        `The projection runs past ${formatINR(MAX_PROJECTED_VALUE)}. Reduce the duration, the step-up or the expected return.`,
      );
    }

    const yearEnd = m % 12 === 0;
    if (yearEnd || m === months) {
      const elapsed = m / 12;
      points.push({
        year: elapsed,
        label: yearEnd ? `Year ${elapsed}` : `${input.years}y ${input.months}m`,
        invested,
        value: balance,
        sip,
      });
    }
  }

  const estimatedValue = balance;
  return {
    months,
    monthlyRate,
    totalInvested: invested,
    estimatedValue,
    estimatedGain: estimatedValue - invested,
    points,
  };
}

/* -------------------------------------------------------------------------- */
/*  The year-by-year table                                                    */
/* -------------------------------------------------------------------------- */

export function buildYearTable(projection: SipProjection): {
  headers: string[];
  rows: string[][];
} {
  return {
    headers: ['Year', 'SIP per month', 'Invested so far', 'Value at year end'],
    rows: projection.points.map((p) => [
      p.label,
      formatINR(p.sip),
      formatINR(p.invested),
      formatINR(p.value),
    ]),
  };
}

/* -------------------------------------------------------------------------- */
/*  The growth chart (hand-rolled SVG — no chart library)                      */
/* -------------------------------------------------------------------------- */

export interface ChartOptions {
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  /** Value already invested at month 0 (the lumpsum) — the left-most point. */
  startValue?: number;
}

const CHART_INK = '#111827';
const CHART_MUTED = '#4b5563';
const CHART_GRID = '#e5e7eb';
const CHART_AXIS = '#9ca3af';
const CHART_INVESTED = '#6b7280';
const CHART_VALUE = '#2563eb';

/**
 * Draw the invested-vs-value growth chart as a standalone SVG string.
 *
 * Every string that reaches the markup is escaped, the drawing scales through
 * a `viewBox`, and there is exactly one marker per year so the chart can be
 * read point by point.
 */
export function buildGrowthChart(points: GrowthPoint[], options: ChartOptions = {}): string {
  const width = options.width ?? 760;
  const height = options.height ?? 420;
  const padLeft = 96;
  const padRight = 30;
  const padTop = 74;
  const padBottom = 68;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const title = options.title ?? 'SIP growth';
  const subtitle = options.subtitle ?? '';
  const startValue = options.startValue ?? 0;

  const lastYear = points.length > 0 ? points[points.length - 1]!.year : 1;
  const maxYear = Math.max(1, lastYear);

  let maxValue = Math.max(startValue, 0);
  for (const p of points) maxValue = Math.max(maxValue, p.value, p.invested);
  const top = maxValue > 0 ? maxValue * 1.08 : 1;

  const x = (year: number) => padLeft + (year / maxYear) * plotWidth;
  const y = (value: number) => padTop + plotHeight - (value / top) * plotHeight;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">`,
  );
  parts.push(`<title>${escapeHtml(title)}</title>`);
  parts.push(
    `<desc>${escapeHtml(
      `Line chart of the amount invested against the estimated value, year by year, from 0 to ${maxYear} years.`,
    )}</desc>`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`);

  // Heading
  parts.push(
    `<text x="${padLeft}" y="30" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" ` +
      `font-size="18" font-weight="600" fill="${CHART_INK}">${escapeHtml(title)}</text>`,
  );
  if (subtitle) {
    parts.push(
      `<text x="${padLeft}" y="50" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" ` +
        `font-size="12" fill="${CHART_MUTED}">${escapeHtml(subtitle)}</text>`,
    );
  }

  // Legend
  const legendY = padTop - 14;
  parts.push(
    `<line x1="${padLeft}" y1="${legendY}" x2="${padLeft + 18}" y2="${legendY}" stroke="${CHART_INVESTED}" stroke-width="2" />`,
  );
  parts.push(
    `<text x="${padLeft + 24}" y="${legendY + 4}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" ` +
      `font-size="12" fill="${CHART_MUTED}">Invested</text>`,
  );
  parts.push(
    `<line x1="${padLeft + 96}" y1="${legendY}" x2="${padLeft + 114}" y2="${legendY}" stroke="${CHART_VALUE}" stroke-width="2" />`,
  );
  parts.push(
    `<text x="${padLeft + 120}" y="${legendY + 4}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" ` +
      `font-size="12" fill="${CHART_MUTED}">Value</text>`,
  );

  // Horizontal grid + value axis labels
  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const value = (top / yTicks) * t;
    const yy = y(value);
    parts.push(
      `<line x1="${padLeft}" y1="${yy.toFixed(2)}" x2="${padLeft + plotWidth}" y2="${yy.toFixed(2)}" ` +
        `stroke="${t === 0 ? CHART_AXIS : CHART_GRID}" stroke-width="1" />`,
    );
    parts.push(
      `<text x="${padLeft - 10}" y="${(yy + 4).toFixed(2)}" text-anchor="end" ` +
        `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="11" ` +
        `fill="${CHART_MUTED}">${escapeHtml(formatCompactINR(value))}</text>`,
    );
  }

  // Year axis
  const yearStep = Math.max(1, Math.ceil(maxYear / 10));
  for (let year = 0; year <= Math.ceil(maxYear); year += yearStep) {
    const xx = x(year);
    parts.push(
      `<line x1="${xx.toFixed(2)}" y1="${padTop}" x2="${xx.toFixed(2)}" y2="${padTop + plotHeight}" ` +
        `stroke="${CHART_GRID}" stroke-width="1" />`,
    );
    parts.push(
      `<text x="${xx.toFixed(2)}" y="${padTop + plotHeight + 18}" text-anchor="middle" ` +
        `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="11" ` +
        `fill="${CHART_MUTED}">${escapeHtml(String(year))}</text>`,
    );
  }

  // Axis titles
  parts.push(
    `<text x="18" y="${(padTop + plotHeight / 2).toFixed(2)}" text-anchor="middle" ` +
      `transform="rotate(-90 18 ${(padTop + plotHeight / 2).toFixed(2)})" ` +
      `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="11" ` +
      `fill="${CHART_MUTED}">Value (₹)</text>`,
  );
  parts.push(
    `<text x="${(padLeft + plotWidth / 2).toFixed(2)}" y="${height - 14}" text-anchor="middle" ` +
      `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="11" ` +
      `fill="${CHART_MUTED}">Years</text>`,
  );

  // Series
  const investedPath = [`${x(0).toFixed(2)},${y(startValue).toFixed(2)}`];
  const valuePath = [`${x(0).toFixed(2)},${y(startValue).toFixed(2)}`];
  for (const p of points) {
    investedPath.push(`${x(p.year).toFixed(2)},${y(p.invested).toFixed(2)}`);
    valuePath.push(`${x(p.year).toFixed(2)},${y(p.value).toFixed(2)}`);
  }
  parts.push(
    `<polyline points="${investedPath.join(' ')}" fill="none" stroke="${CHART_INVESTED}" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
  );
  parts.push(
    `<polyline points="${valuePath.join(' ')}" fill="none" stroke="${CHART_VALUE}" ` +
      `stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`,
  );

  // One marker per year.
  for (const p of points) {
    parts.push(
      `<circle cx="${x(p.year).toFixed(2)}" cy="${y(p.value).toFixed(2)}" r="3.5" ` +
        `fill="${CHART_VALUE}" stroke="#ffffff" stroke-width="1.5">` +
        `<title>${escapeHtml(
          `${p.label}: invested ${formatINR(p.invested)}, value ${formatINR(p.value)}`,
        )}</title></circle>`,
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Wiring the SVG into a data URL (no network, no dependencies)               */
/* -------------------------------------------------------------------------- */

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 safe base64 — `btoa` alone chokes on the ₹ sign. */
export function base64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64[b0 >> 2];
    if (b1 === undefined) {
      out += `${BASE64[(b0 & 3) << 4]}==`;
      break;
    }
    out += BASE64[((b0 & 3) << 4) | (b1 >> 4)];
    if (b2 === undefined) {
      out += `${BASE64[(b1 & 15) << 2]}=`;
      break;
    }
    out += `${BASE64[((b1 & 15) << 2) | (b2 >> 6)]}${BASE64[b2 & 63]}`;
  }
  return out;
}

/** `data:image/svg+xml;base64,…` — inline, so nothing ever leaves the tab. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${base64Utf8(svg)}`;
}

/* -------------------------------------------------------------------------- */
/*  The tool                                                                   */
/* -------------------------------------------------------------------------- */

function tenureLabel(years: number, months: number): string {
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  if (!months) return y;
  return `${y} ${months} ${months === 1 ? 'month' : 'months'}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const plan = parseInputs(o);
  const projection = simulateSip(plan);

  const stats: Record<string, string | number> = {
    totalInvested: formatINR(projection.totalInvested),
    estimatedValue: formatINR(projection.estimatedValue),
    estimatedGain: formatINR(projection.estimatedGain),
    monthlySip: formatINR(plan.monthlySip),
    stepUp: `${plan.stepUpPercent}% a year`,
    assumedReturn: `${plan.annualReturnPercent}% a year`,
    tenure: `${tenureLabel(plan.years, plan.months)} · ${projection.months} instalments`,
  };

  const notes: string[] = [
    'Not financial advice. These are estimates based on an assumed constant annual return — mutual fund returns are not guaranteed and can fall as well as rise.',
    `Total invested ${formatINR(projection.totalInvested)}; estimated value ${formatINR(projection.estimatedValue)} (estimated gain ${formatINR(projection.estimatedGain)}).`,
    plan.timing === 'start'
      ? 'Each instalment is treated as invested at the start of its month, so it also earns that month’s growth.'
      : 'Each instalment is treated as invested at the end of its month, so it starts earning from the next month.',
  ];

  const view = String(o.view) === 'table' ? 'table' : 'chart';

  if (view === 'table') {
    return {
      output: JSON.stringify(buildYearTable(projection)),
      render: 'table',
      filename: 'sip-breakdown.json',
      stats,
      notes,
    };
  }

  const svg = buildGrowthChart(projection.points, {
    title: 'SIP growth',
    subtitle: `${formatINR(projection.totalInvested)} invested over ${tenureLabel(plan.years, plan.months)} → ${formatINR(projection.estimatedValue)}`,
    startValue: plan.lumpsum,
  });

  notes.push(
    'The same figures are available as a year-by-year table — change the Output option to “Year-by-year table”.',
  );

  return {
    output: svgDataUrl(svg),
    render: 'image',
    filename: 'sip-growth.svg',
    stats,
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
