import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'gpa-calculator',
  name: 'GPA Calculator',
  category: 'misc',
  summary: 'Calculate GPA on 4.0 and 10-point scales with configurable percentage conversion.',
  description:
    'Compute your Grade Point Average on both the 4.0 scale (US) and 10-point CGPA scale (India and others). Enter courses with credits and grades, choose your grading scale, and get semester-wise and cumulative results. Includes CGPA ↔ percentage conversion with configurable formulas (CBSE: CGPA × 9.5, GTU: (CGPA − 0.5) × 10, custom multiplier). All calculations run locally in your browser.',
  keywords: [
    'gpa calculator',
    'cgpa calculator',
    'grade point average',
    'cgpa to percentage',
    'percentage to cgpa',
    '4.0 scale gpa',
    '10 point scale',
    'weighted gpa',
    'semester gpa',
    'cumulative gpa',
    'cbse cgpa formula',
    'gtu cgpa formula',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'scale',
      label: 'Grading scale',
      type: 'select',
      default: '4.0',
      choices: [
        { value: '4.0', label: '4.0 Scale (A=4.0, B=3.0, C=2.0, D=1.0, F=0.0)' },
        { value: '10.0', label: '10-Point Scale (A+=10, A=9, B+=8, B=7, C+=6, C=5, D=4, F=0)' },
        { value: '4.0-plus', label: '4.0 Scale with +/- (A+=4.0, A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D+=1.3, D=1.0, F=0.0)' },
      ],
    },
    {
      key: 'conversionFormula',
      label: 'CGPA → Percentage formula',
      type: 'select',
      default: 'cbse',
      choices: [
        { value: 'cbse', label: 'CBSE: CGPA × 9.5' },
        { value: 'gtu', label: 'GTU: (CGPA − 0.5) × 10' },
        { value: 'vtU', label: 'VTU: CGPA × 9.5' },
        { value: 'mumbai', label: 'Mumbai Univ: CGPA × 7.1 + 11' },
        { value: 'custom', label: 'Custom multiplier' },
      ],
    },
    {
      key: 'customMultiplier',
      label: 'Custom multiplier (for custom formula)',
      type: 'number',
      default: 9.5,
      min: 1,
      max: 20,
      step: 0.1,
    },
  ],
  examples: [
    {
      title: 'Semester GPA (4.0 scale)',
      input: 'Course 1,3,A\nCourse 2,4,B+\nCourse 3,3,A-\nCourse 4,2,B',
      options: { scale: '4.0-plus' },
    },
    {
      title: 'CGPA calculation (10-point)',
      input: 'Math,4,9\nPhysics,4,8\nChemistry,4,7\nEnglish,3,9\nCS,3,10',
      options: { scale: '10.0' },
    },
  ],
  faq: [
    {
      q: 'What format should I use for course input?',
      a: 'One course per line: Course Name,Credits,Grade. Example: "Calculus,4,A" or "Physics 101,3,B+". The course name can contain spaces but not commas.',
    },
    {
      q: 'What grades are supported on each scale?',
      a: '4.0: A,B,C,D,F. 4.0+/: A+,A,A-,B+,B,B-,C+,C,C-,D+,D,F. 10-point: 10,9,8,7,6,5,4,0 (or A+,A,B+,B,C+,C,D,F).',
    },
    {
      q: 'How is CGPA different from GPA?',
      a: 'GPA typically refers to a single semester on a 4.0 scale. CGPA (Cumulative Grade Point Average) is the weighted average across all semesters, often on a 10-point scale in Indian universities.',
    },
    {
      q: 'Which CGPA → percentage formula should I use?',
      a: 'Use your university\'s official formula. CBSE (×9.5) is common for Indian boards. GTU uses (CGPA−0.5)×10. Mumbai University uses CGPA×7.1+11. If unsure, check your institution\'s guidelines or use the custom multiplier.',
    },
    {
      q: 'Can I calculate percentage from CGPA and vice versa?',
      a: 'Yes. The tool shows both conversions using the selected formula. For reverse conversion (percentage → CGPA), the formula is inverted where mathematically possible.',
    },
  ],
  related: ['percentage-calculator', 'compound-interest-calculator', 'calculator'],
  status: 'stable',
};