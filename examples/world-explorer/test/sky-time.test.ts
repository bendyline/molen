import { afterEach, describe, expect, it, vi } from 'vitest';
import { localSkyDate, localSkyTime } from '../src/sky-time';

afterEach(() => vi.unstubAllEnvs());

describe('explorer local sky clock', () => {
  it('covers a full calendar day including 24:00 without mutating the date', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(localSkyTime('2024-03-25', 0)).toBe(Date.parse('2024-03-25T07:00:00Z'));
    expect(localSkyTime('2024-03-25', 720)).toBe(Date.parse('2024-03-25T19:00:00Z'));
    expect(localSkyTime('2024-03-25', 1440)).toBe(Date.parse('2024-03-26T07:00:00Z'));
    expect(localSkyDate(new Date('2024-03-25T05:00:00Z'))).toBe('2024-03-24');
  });

  it('uses daylight-saving calendar hours rather than adding 24 fixed hours', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(Number(localSkyTime('2024-03-10', 1440)) - Number(localSkyTime('2024-03-10', 0))).toBe(
      23 * 3600000,
    );
    expect(Number(localSkyTime('2024-11-03', 1440)) - Number(localSkyTime('2024-11-03', 0))).toBe(
      25 * 3600000,
    );
    expect(localSkyTime('2024-03-10', 150)).toBe(Date.parse('2024-03-10T10:30:00Z'));
  });

  it('rejects incomplete and out-of-range edits', () => {
    for (const date of ['', 'bad', '2024-02-30', '1800-01-01', '2200-01-01'])
      expect(localSkyTime(date, 720)).toBeUndefined();
    for (const minutes of [-1, 1441, NaN, 5.5])
      expect(localSkyTime('2024-03-25', minutes)).toBeUndefined();
  });

  it('keeps noon at noon when a daylight-saving transition skips midnight', () => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
    expect(localSkyTime('2018-11-04', 720)).toBe(Date.parse('2018-11-04T14:00:00Z'));
  });
});
