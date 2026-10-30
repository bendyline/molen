import { expect, it } from 'vitest';
import { auditAnimationCoverage } from '../scripts/check-animation-coverage.mjs';

it('ships nonempty, uniquely bound mechanisms for every aircraft and road vehicle', async () => {
  const rows = await auditAnimationCoverage();
  expect(rows.length).toBeGreaterThan(170);
  expect(rows.filter((row) => row.issues.length)).toEqual([]);
  for (const slug of ['airliner', 'f-14d', 'fa-18c', 'a400m'])
    expect(rows.find((r) => r.slug === slug)?.actuators).toContain('speedBrake');
  for (const slug of ['cessna-172s', 'dash-8-q400', 'oh-6'])
    expect(rows.find((r) => r.slug === slug)?.actuators).not.toContain('speedBrake');
  for (const slug of ['f-14d', 'fa-18c'])
    expect(rows.find((r) => r.slug === slug)?.actuators).toContain('tailHook');
  expect(rows.find((r) => r.slug === 'p-51')?.actuators).toContain('canopy');
  expect(rows.find((r) => r.slug === 'cessna-172s')?.gear).toBe('fixed');
  for (const slug of ['dc-3', 'beech-18', 'aw139'])
    expect(rows.find((r) => r.slug === slug)?.gear).toBe('retractable');
}, 30000);
