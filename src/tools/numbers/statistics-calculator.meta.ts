import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'statistics-calculator',
  name: 'Statistics Calculator',
  category: 'numbers',
  summary:
    'Mean, median, mode, variance, standard deviation, quartiles, IQR and outliers from any list of numbers.',
  description:
    'Paste or type a list of numbers and get the full descriptive summary: count, sum, arithmetic/geometric/harmonic mean, median, mode, range, quartiles, IQR, fences, outliers, variance, standard deviation, standard error and coefficient of variation. Choose sample or population formulas and the quartile method.',
  keywords: [
    'statistics',
    'mean',
    'median',
    'mode',
    'standard deviation',
    'variance',
    'quartile',
    'iqr',
    'percentile',
    'outlier',
    'descriptive statistics',
    'average calculator',
    'stddev',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'spread',
      label: 'Variance / SD formula',
      type: 'select',
      default: 'sample',
      choices: [
        { value: 'sample', label: 'Sample (n - 1)' },
        { value: 'population', label: 'Population (N)' },
      ],
    },
    {
      key: 'quartiles',
      label: 'Quartile method',
      type: 'select',
      default: 'inclusive',
      choices: [
        { value: 'inclusive', label: 'Linear interpolation (Excel INC / numpy)' },
        { value: 'exclusive', label: 'Exclusive (Excel EXC)' },
      ],
    },
    {
      key: 'decimals',
      label: 'Decimal places',
      type: 'number',
      default: 4,
      min: 0,
      max: 12,
      step: 1,
    },
  ],
  examples: [
    {
      title: 'Classic textbook dataset',
      input: '2, 4, 4, 4, 5, 5, 7, 9',
      options: { spread: 'population', decimals: 4 },
    },
    {
      title: 'Sample data with an outlier',
      input: '1 2 3 4 5 100',
      options: { spread: 'sample' },
    },
    {
      title: 'Measurements on separate lines',
      input: '12.5\n13.1\n11.8\n12.9\n45.0',
      options: {},
    },
  ],
  faq: [
    {
      q: 'How do I separate the numbers?',
      a: 'Commas, semicolons, spaces, tabs and new lines all work as separators. Negative values, decimals and scientific notation such as 1.2e-3 are understood; anything that is not a number is ignored and reported in the notes.',
    },
    {
      q: 'Sample or population variance?',
      a: 'Use sample (n - 1, Bessel-corrected) when your numbers are a sample of a larger group, which is the usual case. Use population (N) when the list is the entire group. The choice changes variance, standard deviation, standard error and the coefficient of variation.',
    },
    {
      q: 'Which quartile method should I pick?',
      a: 'Linear interpolation (inclusive) matches numpy, R type 7 and Excel QUARTILE.INC. The exclusive method matches Excel QUARTILE.EXC and returns n/a when there are too few values for the requested quantile.',
    },
    {
      q: 'How are outliers detected?',
      a: 'With the Tukey rule: anything below Q1 - 1.5 x IQR or above Q3 + 1.5 x IQR is flagged. The fences themselves are shown so you can see how close the extreme values are.',
    },
    {
      q: 'What happens to empty or invalid input?',
      a: 'Blank input asks for numbers; input with no recognisable numbers reports an error. Text mixed in with numbers is skipped and counted so you can spot copy-paste problems.',
    },
  ],
  related: ['percentage-calculator', 'prime-factorization', 'calculator', 'unit-convert'],
  status: 'stable',
};
