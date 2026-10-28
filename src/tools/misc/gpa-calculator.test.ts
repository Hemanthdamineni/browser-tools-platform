import { describe, it, expect } from 'vitest';
import tool from './gpa-calculator.tool';

describe('gpa-calculator', () => {
  it('calculates GPA on 4.0 scale', async () => {
    const input = 'Math,4,A\nPhysics,3,B\nChemistry,3,C';
    const res = await tool.run({
      text: input,
      options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['GPA (4.0 scale)']).toBeDefined();
    expect(rows['CGPA (10-point scale)']).toBeDefined();
    expect(rows['Percentage']).toBeDefined();
  });

  it('calculates GPA on 4.0+ scale with +/- grades', async () => {
    const input = 'Course1,3,A+\nCourse2,4,A\nCourse3,3,A-\nCourse4,2,B+';
    const res = await tool.run({
      text: input,
      options: { scale: '4.0-plus', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(parseFloat(rows['GPA (4.0 scale)'])).toBeGreaterThan(3.5);
  });

  it('calculates CGPA on 10-point scale', async () => {
    const input = 'Math,4,9\nPhysics,4,8\nChemistry,4,7\nEnglish,3,9\nCS,3,10';
    const res = await tool.run({
      text: input,
      options: { scale: '10.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['CGPA (10-point scale)']).toBeDefined();
    expect(parseFloat(rows['CGPA (10-point scale)'])).toBeGreaterThan(7);
  });

  it('applies CBSE conversion formula (CGPA × 9.5)', async () => {
    const input = 'Course1,4,10\nCourse2,4,10';
    const res = await tool.run({
      text: input,
      options: { scale: '10.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Percentage']).toBe('95.00%');
  });

  it('applies GTU conversion formula ((CGPA - 0.5) × 10)', async () => {
    const input = 'Course1,4,10\nCourse2,4,10';
    const res = await tool.run({
      text: input,
      options: { scale: '10.0', conversionFormula: 'gtu', customMultiplier: 9.5 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Percentage']).toBe('95.00%');
  });

  it('applies Mumbai University formula (CGPA × 7.1 + 11)', async () => {
    const input = 'Course1,4,10\nCourse2,4,10';
    const res = await tool.run({
      text: input,
      options: { scale: '10.0', conversionFormula: 'mumbai', customMultiplier: 9.5 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Percentage']).toBe('82.00%');
  });

  it('uses custom multiplier', async () => {
    const input = 'Course1,4,10\nCourse2,4,10';
    const res = await tool.run({
      text: input,
      options: { scale: '10.0', conversionFormula: 'custom', customMultiplier: 10 },
    });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Percentage']).toBe('100.00%');
  });

  it('throws on invalid line format', async () => {
    const input = 'Invalid line';
    let error: Error | null = null;
    try {
      await tool.run({
        text: input,
        options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Invalid line format');
  });

  it('throws on invalid credits', async () => {
    const input = 'Course,invalid,A';
    let error: Error | null = null;
    try {
      await tool.run({
        text: input,
        options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Invalid credits');
  });

  it('throws on unknown grade for scale', async () => {
    const input = 'Course,4,Z';
    let error: Error | null = null;
    try {
      await tool.run({
        text: input,
        options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Unknown grade');
  });

  it('handles empty input', async () => {
    const res = await tool.run({
      text: '',
      options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    expect(parsed.rows[0][1]).toContain('Enter courses');
  });

  it('includes course breakdown', async () => {
    const input = 'Math,4,A\nPhysics,3,B';
    const res = await tool.run({
      text: input,
      options: { scale: '4.0', conversionFormula: 'cbse', customMultiplier: 9.5 },
    });
    const parsed = JSON.parse(res.output);
    const rows = parsed.rows;
    const courseRows = rows.filter((r: string[]) => r[0] === 'Math' || r[0] === 'Physics');
    expect(courseRows.length).toBe(2);
  });
});
