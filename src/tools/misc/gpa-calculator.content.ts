/**
 * Editorial content for the gpa-calculator tool page.
 *
 * Kept out of `gpa-calculator.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What you get back',
      body: 'List your courses one per line as Course Name,Credits,Grade and the tool returns the grade points and weighted points for each course, the total credits, and your GPA on the selected scale — a plain 4.0 scale, a 4.0 scale with plus/minus grades, or a 10-point scale. It also shows the cross-scale reference value (4.0 ↔ 10-point) so you can compare against applications that expect the other system.',
    },
    {
      heading: 'Percentage conversion',
      body: 'The CGPA-to-percentage step uses the formula you select: CBSE multiplies by 9.5, GTU computes (CGPA − 0.5) × 10, Mumbai University computes CGPA × 7.1 + 11, and a custom option takes any multiplier you type. The reverse conversion (percentage back to CGPA) is shown where the formula can be inverted, so you can sanity-check the round trip.',
    },
    {
      heading: 'How the grade maps work',
      body: 'On the 4.0 plus/minus scale A+ to F maps to 4.0 down to 0.0 in 0.3 steps; the plain scale uses whole grades only. The 10-point scale accepts either letter grades (A+ = 10 down to D = 4) or the numeric marks directly. Unknown grades are refused with a message naming the valid values rather than silently counted as zero.',
    },
    {
      heading: 'What it is not',
      body: "The 4.0 ↔ 10-point cross-reference is the common ×2.5 approximation, which suits quick comparisons but is not any university's official conversion — use the formula picker for that. Everything runs in your browser: nothing is uploaded, nothing is stored.",
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
      a: "Use your university's official formula. CBSE (×9.5) is common for Indian boards. GTU uses (CGPA−0.5)×10. Mumbai University uses CGPA×7.1+11. If unsure, check your institution's guidelines or use the custom multiplier.",
    },
    {
      q: 'Can I calculate percentage from CGPA and vice versa?',
      a: 'Yes. The tool shows both conversions using the selected formula. For reverse conversion (percentage → CGPA), the formula is inverted where mathematically possible.',
    },
  ],
};
