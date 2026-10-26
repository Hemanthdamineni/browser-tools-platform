/**
 * Editorial content for the bmi-calculator tool page.
 *
 * Kept out of ``bmi-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What you get back',
      body: 'Enter a height and weight in either metric (centimetres and kilograms) or imperial (feet, inches and pounds) and the tool reports the body mass index to one decimal place, the WHO weight category (Underweight, Normal, Overweight or Obese), the healthy weight range for that exact height in kilograms and the BMI Prime — the ratio of your BMI to 25, which sits at the top of the normal band.',
    },
    {
      heading: 'How the units are reconciled',
      body: 'In imperial mode the height is converted as (feet x 12 + inches) x 2.54 to centimetres and the weight as pounds x 0.45359237 to kilograms, so the BMI formula is always the same underneath regardless of which unit picker you use. Values that are zero, negative or non-numeric are refused with a clear message rather than producing a meaningless number.',
    },
    {
      heading: 'What the healthy range is for',
      body: 'The healthy weight range is the kilogram span whose BMI falls between 18.5 and 24.9 — the two category boundaries — recomputed for your entered height. It is a guide to how far you are from the normal band in real weight terms, which is often easier to act on than a dimensionless index.',
    },
    {
      heading: 'What it is not, and privacy',
      body: 'BMI is a screening measure for groups, not a diagnosis: it ignores muscle mass, frame and age, and it tells you nothing about health for any one person. The calculation is done entirely in your browser from the numbers you type, with no storage, no network and no upload, so it works fully offline.',
    },
  ],
  faq: [
    {
      q: 'What do the categories mean?',
      a: 'Underweight is below 18.5, Normal is 18.5–24.9, Overweight is 25–29.9 and Obese is 30 or above. BMI is a screening measure, not a diagnosis.',
    },
    {
      q: 'What is BMI Prime?',
      a: 'BMI Prime is your BMI divided by 25, the upper edge of the normal band. A value of 1.0 or below sits within the normal range, and each 0.1 above 1.0 is roughly 10% over that boundary.',
    },
    {
      q: 'Is my height and weight stored anywhere?',
      a: 'No. The numbers are converted and the BMI computed in your browser; nothing is saved, uploaded or sent over the network, and the page works offline.',
    },
  ],
} as const;
