import { describe, expect, it } from 'vitest';
import { plantCalendar } from '../src/kernel/plant-calendar';
import { projectWgs84 } from '../src/kernel/projection';

describe('explicit deciduous calendar', () => {
  it('reverses hemispheres, extends polar dormancy, and leaves the tropics and omitted month neutral', () => {
    const at = (month: number | undefined, latitude: number, scale = 1) =>
      plantCalendar(month, scale)(projectWgs84(0, latitude)[1] * scale);
    expect(at(1, 48)).toBe('winter');
    expect(at(1, -48)).toBe('summer');
    expect(at(7, -48, 0.67)).toBe('winter');
    expect(at(4, 48)).toBe('spring');
    expect(at(4, 70)).toBe('winter');
    expect(at(10, 48)).toBe('autumn');
    expect(at(10, -48)).toBe('spring');
    for (const lat of [-23, 0, 23])
      for (let month = 1; month <= 12; month++) expect(at(month, lat)).toBe('summer');
    expect(at(undefined, 70)).toBe('summer');
    for (const month of [0, 13, 1.5, NaN])
      expect(() => plantCalendar(month, 1)).toThrow(/vegetationMonth/);
  });
});
