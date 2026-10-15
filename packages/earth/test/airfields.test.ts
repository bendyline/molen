// EarthAirfields against a fake network: one runway and one aerodrome in a flat local frame.
import type { TransportRunway } from '@bendyline/molen-ambient/kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compassBearing,
  destinationPoint,
  EarthAirfields,
  type EarthAirfieldsSource,
  type EarthPlace,
  haversineDistance,
  runwayId,
} from '../src/client/airfields';

const LAT0 = 47.53;
const LNG0 = -122.3;
const METRES_PER_DEG_LAT = 111_320;
const METRES_PER_DEG_LNG = METRES_PER_DEG_LAT * Math.cos(LAT0 * (Math.PI / 180));
const HEADING = 0.3; // radians, a little east of north
const LENGTH = 1_500;
const SURFACE_Y = 25;

/**
 * A fake source with an equirectangular world frame (east +X, north -Z) whose origin sits
 * `offset` metres from (LAT0, LNG0), so two frames can hold the same geographic runway.
 */
function fakeSource(offset: [number, number] = [0, 0]) {
  const runways: (TransportRunway & { surface?: string })[] = [];
  const aerodromes: { x: number; z: number; name?: string }[] = [];
  let version = 0;
  const source: EarthAirfieldsSource = {
    runways: () => runways,
    aerodromes: () => aerodromes,
    version: () => version,
    toGeo: (x, z) => ({
      latitude: LAT0 - (z - offset[1]) / METRES_PER_DEG_LAT,
      longitude: LNG0 + (x - offset[0]) / METRES_PER_DEG_LNG,
    }),
    toWorld: (latitude, longitude) => [
      offset[0] + (longitude - LNG0) * METRES_PER_DEG_LNG,
      offset[1] - (latitude - LAT0) * METRES_PER_DEG_LAT,
    ],
  };
  const addRunway = (): void => {
    runways.push({
      tile: 't',
      ax: offset[0],
      az: offset[1],
      bx: offset[0] + LENGTH * Math.sin(HEADING),
      bz: offset[1] - LENGTH * Math.cos(HEADING),
      y: SURFACE_Y,
    });
    aerodromes.push({ x: offset[0] + 400, z: offset[1] - 600, name: 'Test Field' });
    version++;
  };
  return { source, addRunway, bump: () => version++ };
}

describe('EarthAirfields', () => {
  it('reports the runways near a place with geodesic heading, length and aerodrome', () => {
    const { source, addRunway } = fakeSource();
    addRunway();
    const airfields = new EarthAirfields(source);
    const [runway, ...rest] = airfields.near(LAT0, LNG0, 2_000);
    expect(rest).toHaveLength(0);
    if (runway === undefined) throw new Error('expected a runway');
    expect(runway.id).toMatch(/^runway:[0-9a-z]+$/);
    expect(Math.abs(runway.heading - HEADING)).toBeLessThan(0.01);
    expect(Math.abs(runway.length - LENGTH)).toBeLessThan(2);
    expect(runway.elevation).toBe(SURFACE_Y);
    expect(runway.ends[0].latitude).toBeCloseTo(LAT0, 6);
    expect(runway.ends[0].longitude).toBeCloseTo(LNG0, 6);
    expect(runway.aerodrome?.name).toBe('Test Field');
    expect(runway.surface).toBeUndefined();
    // The midpoint is 750 m away; a tighter radius or a far place finds nothing.
    expect(airfields.near(LAT0, LNG0, 500)).toEqual([]);
    expect(airfields.near(LAT0 + 1, LNG0, 2_000)).toEqual([]);
  });

  it('keeps the same id for the same geographic runway in a re-anchored world frame', () => {
    const first = fakeSource([0, 0]);
    const second = fakeSource([12_345, -6_789]);
    first.addRunway();
    second.addRunway();
    const a = new EarthAirfields(first.source).near(LAT0, LNG0, 2_000)[0];
    const b = new EarthAirfields(second.source).near(LAT0, LNG0, 2_000)[0];
    expect(a?.id).toBeDefined();
    expect(a?.id).toBe(b?.id);
    expect(a?.id).toBe(runwayId(a?.ends[0] as EarthPlace, a?.ends[1] as EarthPlace));
  });

  it('places a threshold 60 m in from end a, facing down the runway', () => {
    const { source, addRunway } = fakeSource();
    addRunway();
    const airfields = new EarthAirfields(source);
    const runway = airfields.near(LAT0, LNG0, 2_000)[0];
    if (runway === undefined) throw new Error('expected a runway');
    const threshold = airfields.placement(runway.id, 'threshold');
    if (threshold === undefined) throw new Error('expected a placement');
    expect(Math.abs(haversineDistance(runway.ends[0], threshold) - 60)).toBeLessThan(0.5);
    expect(Math.abs(compassBearing(runway.ends[0], threshold) - HEADING)).toBeLessThan(0.01);
    expect(Math.abs((threshold.heading ?? 0) - HEADING)).toBeLessThan(0.01);
    expect(threshold.elevation).toBe(SURFACE_Y);

    const other = airfields.placement(runway.id, 'threshold', { end: 'b' });
    if (other === undefined) throw new Error('expected a placement');
    expect(Math.abs(haversineDistance(runway.ends[1], other) - 60)).toBeLessThan(0.5);
    expect(Math.abs((other.heading ?? 0) - (HEADING + Math.PI))).toBeLessThan(0.01);

    const midpoint = airfields.placement(runway.id, 'midpoint');
    if (midpoint === undefined) throw new Error('expected a placement');
    expect(Math.abs(haversineDistance(runway.ends[0], midpoint) - LENGTH / 2)).toBeLessThan(1);
    expect(airfields.placement('runway:nope', 'threshold')).toBeUndefined();
  });

  it('parks beside the threshold, 40 m to the right, parallel to the runway', () => {
    const { source, addRunway } = fakeSource();
    addRunway();
    const airfields = new EarthAirfields(source);
    const runway = airfields.near(LAT0, LNG0, 2_000)[0];
    if (runway === undefined) throw new Error('expected a runway');
    const threshold = airfields.placement(runway.id, 'threshold');
    const beside = airfields.placement(runway.id, 'beside');
    if (threshold === undefined || beside === undefined) throw new Error('expected placements');
    expect(Math.abs(haversineDistance(threshold, beside) - 40)).toBeLessThan(0.5);
    expect(Math.abs(compassBearing(threshold, beside) - (HEADING + Math.PI / 2))).toBeLessThan(
      0.01,
    );
    expect(Math.abs((beside.heading ?? 0) - HEADING)).toBeLessThan(0.01);
    const wide = airfields.placement(runway.id, 'beside', { offsetM: 90 });
    if (wide === undefined) throw new Error('expected a placement');
    expect(Math.abs(haversineDistance(threshold, wide) - 90)).toBeLessThan(0.5);
  });

  it('samples the elevation at a placement through the source when it offers one', () => {
    const { source, addRunway } = fakeSource();
    addRunway();
    const sampled: [number, number, number][] = [];
    const airfields = new EarthAirfields({
      ...source,
      toElevation: (x, z, y) => {
        sampled.push([x, z, y]);
        return y + 100;
      },
    });
    const runway = airfields.near(LAT0, LNG0, 2_000)[0];
    if (runway === undefined) throw new Error('expected a runway');
    expect(runway.elevation).toBe(SURFACE_Y + 100);
    const beside = airfields.placement(runway.id, 'beside');
    expect(beside?.elevation).toBe(SURFACE_Y + 100);
    // The placement was sampled at its own spot with the network's surface height, not twice.
    const last = sampled[sampled.length - 1];
    if (last === undefined) throw new Error('expected a sample');
    expect(last[2]).toBe(SURFACE_Y);
    const [bx, bz] = source.toWorld(beside?.latitude ?? 0, beside?.longitude ?? 0);
    expect(last[0]).toBeCloseTo(bx, 3);
    expect(last[1]).toBeCloseTo(bz, 3);
  });

  describe('whenNear', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('resolves once a runway appears and the version moves', async () => {
      const { source, addRunway, bump } = fakeSource();
      const airfields = new EarthAirfields(source);
      let settled = false;
      const pending = airfields.whenNear(LAT0, LNG0, { radiusM: 2_000 }).then((runways) => {
        settled = true;
        return runways;
      });
      airfields.tick();
      await Promise.resolve();
      expect(settled).toBe(false);
      // A version bump without a runway in range keeps waiting.
      bump();
      airfields.tick();
      await Promise.resolve();
      expect(settled).toBe(false);
      addRunway();
      airfields.tick();
      const runways = await pending;
      expect(runways).toHaveLength(1);
      expect(Math.abs((runways[0]?.length ?? 0) - LENGTH)).toBeLessThan(2);
    });

    it('resolves at once when a runway is already near', async () => {
      const { source, addRunway } = fakeSource();
      addRunway();
      const airfields = new EarthAirfields(source);
      await expect(airfields.whenNear(LAT0, LNG0, { radiusM: 2_000 })).resolves.toHaveLength(1);
    });

    it('resolves with [] on timeout', async () => {
      const { source } = fakeSource();
      const airfields = new EarthAirfields(source);
      const pending = airfields.whenNear(LAT0, LNG0, { radiusM: 2_000, timeoutMs: 1_000 });
      await vi.advanceTimersByTimeAsync(999);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual([]);
    });

    it('rejects on abort, and when disposed', async () => {
      const { source } = fakeSource();
      const airfields = new EarthAirfields(source);
      const controller = new AbortController();
      const aborted = airfields.whenNear(LAT0, LNG0, {
        radiusM: 2_000,
        signal: controller.signal,
      });
      controller.abort();
      await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
      const already = airfields.whenNear(LAT0, LNG0, { radiusM: 2_000, signal: controller.signal });
      await expect(already).rejects.toMatchObject({ name: 'AbortError' });
      const orphan = airfields.whenNear(LAT0, LNG0, { radiusM: 2_000 });
      airfields.dispose();
      await expect(orphan).rejects.toMatchObject({ name: 'AbortError' });
      await expect(airfields.whenNear(LAT0, LNG0, { radiusM: 2_000 })).rejects.toMatchObject({
        name: 'AbortError',
      });
    });
  });

  it('geodesic helpers agree with each other', () => {
    const from = { latitude: LAT0, longitude: LNG0 };
    const there = destinationPoint(from, 1.1, 2_500);
    expect(Math.abs(haversineDistance(from, there) - 2_500)).toBeLessThan(0.01);
    expect(Math.abs(compassBearing(from, there) - 1.1)).toBeLessThan(1e-6);
    // Bearings wrap in [0, 2π): due north may come back as 2π minus rounding.
    const turn = (a: number, b: number): number =>
      Math.abs(((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(turn(compassBearing(from, destinationPoint(from, 0, 100)), 0)).toBeLessThan(1e-6);
    expect(
      turn(compassBearing(from, destinationPoint(from, Math.PI / 2, 100)), Math.PI / 2),
    ).toBeLessThan(1e-6);
    expect(runwayId(from, there)).not.toBe(runwayId(there, from));
    expect(runwayId(from, there)).toBe(
      runwayId({ latitude: LAT0 + 1e-7, longitude: LNG0 - 1e-7 }, there),
    );
  });
});
