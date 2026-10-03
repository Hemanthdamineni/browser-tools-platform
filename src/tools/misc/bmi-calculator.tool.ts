import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './bmi-calculator.meta';

function category(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const units = String(o.units);
  let heightCm: number;
  let weightKg: number;
  if (units === 'imperial') {
    const ft = Number(o.heightFt);
    const inch = Number(o.heightIn);
    const lb = Number(o.weightLb);
    if (
      !Number.isFinite(ft) ||
      ft <= 0 ||
      !Number.isFinite(inch) ||
      inch < 0 ||
      !Number.isFinite(lb) ||
      lb <= 0
    ) {
      throw new ToolError('Height and weight must be positive numbers.');
    }
    heightCm = (ft * 12 + inch) * 2.54;
    weightKg = lb * 0.45359237;
  } else {
    const cm = Number(o.heightCm);
    const kg = Number(o.weightKg);
    if (!Number.isFinite(cm) || cm <= 0 || !Number.isFinite(kg) || kg <= 0) {
      throw new ToolError('Height and weight must be positive numbers.');
    }
    heightCm = cm;
    weightKg = kg;
  }
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  const bmiStr = bmi.toFixed(1);
  const low = 18.5 * m * m;
  const high = 24.9 * m * m;
  const prime = bmi / 25;
  const rows = [
    ['BMI', bmiStr],
    ['Category', category(bmi)],
    ['Healthy weight range', `${low.toFixed(1)}–${high.toFixed(1)} kg`],
    ['BMI Prime', prime.toFixed(2)],
  ];
  return {
    output: JSON.stringify({ headers: ['Measurement', 'Value'], rows }),
    render: 'table',
    stats: { bmi: bmiStr },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
