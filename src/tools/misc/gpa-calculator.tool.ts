import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gpa-calculator.meta';

interface Course {
  name: string;
  credits: number;
  grade: string;
}

const GRADE_MAP_4: Record<string, number> = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  'D-': 0.7,
  F: 0.0,
};

const GRADE_MAP_4_SIMPLE: Record<string, number> = {
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  F: 0.0,
};

const GRADE_MAP_10: Record<string, number> = {
  'A+': 10,
  A: 9,
  'B+': 8,
  B: 7,
  'C+': 6,
  C: 5,
  D: 4,
  F: 0,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '0': 0,
};

function parseCourses(text: string): Course[] {
  const lines = text
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const courses: Course[] = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length !== 3) {
      throw new ToolError(`Invalid line format: "${line}". Use: Course Name,Credits,Grade`);
    }
    const name = parts[0];
    const creditsStr = parts[1];
    const grade = parts[2];
    if (name === undefined || creditsStr === undefined || grade === undefined) {
      throw new ToolError(`Invalid line format: "${line}". Use: Course Name,Credits,Grade`);
    }
    const credits = parseFloat(creditsStr);
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new ToolError(`Invalid credits: "${creditsStr}" in line "${line}"`);
    }
    courses.push({ name, credits, grade: grade.toUpperCase() });
  }
  return courses;
}

function getGradePoints(grade: string, scale: string): number {
  if (scale === '4.0') {
    const simple = GRADE_MAP_4_SIMPLE[grade];
    if (simple !== undefined) return simple;
    const full = GRADE_MAP_4[grade];
    if (full !== undefined) return full;
    throw new ToolError(`Unknown grade "${grade}" for 4.0 scale. Use A,B,C,D,F.`);
  }
  if (scale === '4.0-plus') {
    const full = GRADE_MAP_4[grade];
    if (full !== undefined) return full;
    throw new ToolError(
      `Unknown grade "${grade}" for 4.0+/- scale. Use A+,A,A-,B+,B,B-,C+,C,C-,D+,D,F.`,
    );
  }
  if (scale === '10.0') {
    const pts = GRADE_MAP_10[grade];
    if (pts !== undefined) return pts;
    throw new ToolError(
      `Unknown grade "${grade}" for 10-point scale. Use 10,9,8,7,6,5,4,0 or A+,A,B+,B,C+,C,D,F.`,
    );
  }
  throw new ToolError(`Unknown scale: ${scale}`);
}

function cgpaToPercentage(cgpa: number, formula: string, customMultiplier: number): number {
  switch (formula) {
    case 'cbse':
    case 'vtU':
      return cgpa * 9.5;
    case 'gtu':
      return (cgpa - 0.5) * 10;
    case 'mumbai':
      return cgpa * 7.1 + 11;
    case 'custom':
      return cgpa * customMultiplier;
    default:
      return cgpa * 9.5;
  }
}

function percentageToCgpa(
  percentage: number,
  formula: string,
  customMultiplier: number,
): number | null {
  switch (formula) {
    case 'cbse':
    case 'vtU':
      return percentage / 9.5;
    case 'gtu':
      return percentage / 10 + 0.5;
    case 'mumbai':
      return (percentage - 11) / 7.1;
    case 'custom':
      return percentage / customMultiplier;
    default:
      return percentage / 9.5;
  }
}

function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const scale = String(options.scale);
  const conversionFormula = String(options.conversionFormula);
  const customMultiplier = Number(options.customMultiplier) || 9.5;
  const text = input.text.trim();

  if (!text) {
    return {
      output: JSON.stringify({
        headers: ['Metric', 'Value'],
        rows: [
          ['Status', 'Enter courses to calculate GPA'],
          ['Format', 'Course Name,Credits,Grade (one per line)'],
        ],
      }),
      render: 'table',
    };
  }

  const courses = parseCourses(text);

  let totalCredits = 0;
  let totalGradePoints = 0;
  const courseRows: string[][] = [];

  for (const course of courses) {
    const gradePoints = getGradePoints(course.grade, scale);
    const weightedPoints = gradePoints * course.credits;
    totalCredits += course.credits;
    totalGradePoints += weightedPoints;
    courseRows.push([
      course.name,
      course.credits.toString(),
      course.grade,
      formatNumber(gradePoints, scale === '10.0' ? 0 : 2),
      formatNumber(weightedPoints, scale === '10.0' ? 0 : 2),
    ]);
  }

  const gpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

  // Convert to other scales for reference
  let gpa4: number;
  let cgpa10: number;

  if (scale === '4.0' || scale === '4.0-plus') {
    gpa4 = gpa;
    // Approximate conversion 4.0 -> 10.0
    cgpa10 = gpa4 * 2.5;
  } else {
    cgpa10 = gpa;
    gpa4 = gpa / 2.5;
  }

  const percentage = cgpaToPercentage(cgpa10, conversionFormula, customMultiplier);

  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Courses Entered', courses.length.toString()],
    ['Total Credits', totalCredits.toString()],
    ['', ''],
    ['Results (Selected Scale)', ''],
    [`GPA (${scale})`, formatNumber(gpa, scale === '10.0' ? 2 : 2)],
    ['', ''],
    ['Cross-Scale Reference', ''],
    ['GPA (4.0 scale)', formatNumber(gpa4, 2)],
    ['CGPA (10-point scale)', formatNumber(cgpa10, 2)],
    ['', ''],
    ['Percentage Conversion', ''],
    [
      `Formula`,
      conversionFormula === 'custom'
        ? `Custom (×${customMultiplier})`
        : conversionFormula.toUpperCase(),
    ],
    ['Percentage', `${formatNumber(percentage, 2)}%`],
  ];

  // Reverse conversion
  const reverseCgpa = percentageToCgpa(percentage, conversionFormula, customMultiplier);
  if (reverseCgpa !== null) {
    rows.push(['CGPA from % (reverse)', formatNumber(reverseCgpa, 2)]);
  }

  rows.push(['', ''], ['Course Breakdown', '']);
  rows.push(['Course', 'Credits', 'Grade', 'Grade Pts', 'Weighted Pts']);
  for (const cr of courseRows) rows.push(cr);

  const output = JSON.stringify({ headers: ['Metric', 'Value'], rows });
  return {
    output,
    render: 'table',
    stats: {
      courses: courses.length,
      totalCredits,
      gpa4: Number(gpa4.toFixed(2)),
      cgpa10: Number(cgpa10.toFixed(2)),
      percentage: Number(percentage.toFixed(2)),
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
