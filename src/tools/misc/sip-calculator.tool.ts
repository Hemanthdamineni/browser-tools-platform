import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sip-calculator.meta';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  const monthlyInvestment = Number(options.monthlyInvestment) || 0;
  const annualReturn = Number(options.annualReturn) || 0;
  const years = Math.round(Number(options.years) || 0);
  const stepUpPercent = Number(options.stepUpPercent) || 0;
  const lumpsumAmount = Number(options.lumpsumAmount) || 0;

  const monthlyRate = annualReturn / 100 / 12;
  const totalMonths = years * 12;

  let totalInvested = 0;
  let finalValue = 0;
  const yearlyData: Array<{
    year: number;
    invested: number;
    returns: number;
    total: number;
    monthlyAmt: number;
  }> = [];

  if (mode === 'sip') {
    // Standard SIP: FV = P * [((1+r)^n - 1) / r] * (1+r) for annuity due
    if (monthlyRate > 0) {
      finalValue = monthlyInvestment * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate);
    } else {
      finalValue = monthlyInvestment * totalMonths;
    }
    totalInvested = monthlyInvestment * totalMonths;

    // Yearly breakdown
    let runningValue = 0;
    for (let y = 1; y <= years; y++) {
      const monthsInYear = Math.min(12, totalMonths - (y - 1) * 12);
      if (monthsInYear <= 0) break;

      for (let m = 1; m <= monthsInYear; m++) {
        runningValue = (runningValue + monthlyInvestment) * (1 + monthlyRate);
      }

      const investedThisYear = monthlyInvestment * monthsInYear;
      totalInvested = monthlyInvestment * y * 12;
      if (y === years) totalInvested = monthlyInvestment * totalMonths;

      yearlyData.push({
        year: y,
        invested: totalInvested,
        returns: runningValue - totalInvested,
        total: runningValue,
        monthlyAmt: monthlyInvestment,
      });
    }
  } else if (mode === 'step-up') {
    // Step-up SIP: each year monthly amount increases
    let runningValue = 0;
    let currentMonthly = monthlyInvestment;
    totalInvested = 0;

    for (let y = 1; y <= years; y++) {
      const monthsInYear = Math.min(12, totalMonths - (y - 1) * 12);
      if (monthsInYear <= 0) break;

      for (let m = 1; m <= monthsInYear; m++) {
        runningValue = (runningValue + currentMonthly) * (1 + monthlyRate);
      }

      totalInvested += currentMonthly * monthsInYear;

      yearlyData.push({
        year: y,
        invested: totalInvested,
        returns: runningValue - totalInvested,
        total: runningValue,
        monthlyAmt: currentMonthly,
      });

      currentMonthly = currentMonthly * (1 + stepUpPercent / 100);
    }

    finalValue = runningValue;
  } else if (mode === 'lumpsum') {
    // Lumpsum: P(1+r)^n
    if (monthlyRate > 0) {
      finalValue = lumpsumAmount * Math.pow(1 + monthlyRate, totalMonths);
    } else {
      finalValue = lumpsumAmount;
    }
    totalInvested = lumpsumAmount;

    // Yearly breakdown
    for (let y = 1; y <= years; y++) {
      const monthsElapsed = y * 12;
      const valueAtYear = lumpsumAmount * Math.pow(1 + monthlyRate, monthsElapsed);
      yearlyData.push({
        year: y,
        invested: lumpsumAmount,
        returns: valueAtYear - lumpsumAmount,
        total: valueAtYear,
        monthlyAmt: 0,
      });
    }
  }

  const totalReturns = finalValue - totalInvested;
  const absoluteReturnPct = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;
  const cagr = totalInvested > 0 && years > 0 ? (Math.pow(finalValue / totalInvested, 1 / years) - 1) * 100 : 0;

  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Investment Type', mode === 'sip' ? 'SIP (Fixed Monthly)' : mode === 'step-up' ? 'Step-up SIP' : 'Lumpsum'],
    ['', ''],
    ['Input Parameters', ''],
    ...(mode === 'lumpsum'
      ? [['Lumpsum Amount', formatCurrency(lumpsumAmount)]]
      : [
          ['Monthly Investment', formatCurrency(monthlyInvestment)],
          ...(mode === 'step-up' ? [['Annual Step-up', `${stepUpPercent}%`]] : []),
        ]),
    ['Expected Annual Return', `${annualReturn}%`],
    ['Duration', `${years} years`],
    ['', ''],
    ['Results', ''],
    ['Total Invested', formatCurrency(totalInvested)],
    ['Estimated Returns', formatCurrency(totalReturns)],
    ['Final Corpus', formatCurrency(finalValue)],
    ['Absolute Return', `${formatNumber(absoluteReturnPct)}%`],
    ['CAGR (Annualized)', `${formatNumber(cagr)}%`],
    ['', ''],
    ['⚠ NOT FINANCIAL ADVICE', ''],
    ['Disclaimer', 'This calculator performs mathematical projections based on your inputs. It does not constitute financial advice. Past performance does not guarantee future results. Actual returns vary by fund, market conditions, fees, taxes, and inflation. Consult a SEBI-registered investment advisor before investing.'],
    ['', ''],
    ['Year-by-Year Breakdown', ''],
    ['Year', 'Monthly Amt', 'Total Invested', 'Est. Returns', 'Total Value'],
  ];

  for (const yd of yearlyData) {
    rows.push([
      yd.year.toString(),
      yd.monthlyAmt > 0 ? formatCurrency(yd.monthlyAmt) : '—',
      formatCurrency(yd.invested),
      formatCurrency(yd.returns),
      formatCurrency(yd.total),
    ]);
  }

  const output = JSON.stringify({ headers: ['Metric', 'Value'], rows });
  return {
    output,
    render: 'table',
    stats: {
      totalInvested,
      totalReturns,
      finalValue,
      absoluteReturnPct,
      cagr,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;