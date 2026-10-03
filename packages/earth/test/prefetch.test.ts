import {
  terrainPyramidBudgetForQuality,
  terrainPyramidDescriptorFromPackage,
} from '@bendyline/molen-terrain/client';
import {
  type TerrainPackageDescriptor,
  terrainPackageMetersPerUnit,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEarthPrefetcher,
  createMotionEstimator,
  earthPrefetchTargets,
  extrapolateTrack,
} from '../src/client/prefetch';

const pkg: TerrainPackageDescriptor = {
  format: 'molen/terrain-package@1',
  name: 'unit-earth',
  version: '1',
  coordinateSpace: {
    kind: 'geospatial',
    crs: 'EPSG:3857',
    ellipsoid: 'WGS84',
    bounds: [-180, -85.0511287798066, 180, 85.0511287798066],
  },
  tileMatrix: { scheme: 'xyz', minLevel: 0, maxLevel: 14, rootTiles: [1, 1], tileResolution: 3 },
  elevation: {
    source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
    encoding: 'png16',
    height: { min: -100, max: 900 },
  },
  attribution: [{ text: 'Test', license: 'CC0-1.0' }],
  provenance: { compiler: 'test', compilerVersion: '1', sources: [{ id: 't', release: '1' }] },
  files: [],
};
const frame = { latitude: 47.6 };
const metersPerUnit = terrainPackageMetersPerUnit(pkg, frame);
const descriptor = terrainPyramidDescriptorFromPackage(pkg, { minLevel: 0, maxLevel: 14, frame });

/** An archive that records every read. */
function countingArchive(reads: Array<{ level: number; x: number; y: number }>) {
  return {
    getZxy: async (level: number, x: number, y: number) => {
      reads.push({ level, x, y });
      return { data: new ArrayBuffer(1) };
    },
  };
}

function prefetcher(
  overrides: Partial<Parameters<typeof createEarthPrefetcher>[0]> = {},
  reads: Array<{ level: number; x: number; y: number }> = [],
) {
  const budget = terrainPyramidBudgetForQuality('balanced');
  return createEarthPrefetcher({
    descriptor,
    scheme: 'xyz',
    archives: {
      elevation: { archive: countingArchive(reads), maxLevel: 12 },
      features: { archive: countingArchive(reads), minLevel: 4, maxLevel: 14 },
    },
    metersPerUnit,
    budget: () => budget,
    resident: () => new Set(),
    busy: () => false,
    groundHeight: () => 0,
    viewShape: () => ({ verticalFov: Math.PI / 3, viewportHeight: 600, aspect: 4 / 3 }),
    ...overrides,
  });
}

const world = (latitude: number, longitude: number, metersUp = 300): [number, number, number] => {
  const [x, z] = wgs84ToWorld(metersPerUnit, longitude, latitude);
  return [x, metersUp / metersPerUnit, z];
};

afterEach(() => vi.unstubAllGlobals());

describe('createMotionEstimator', () => {
  it('converges on a steady velocity and restarts after a jump', () => {
    const motion = createMotionEstimator({ smoothingSeconds: 0.5, maxStep: 100 });
    let velocity: number[] | undefined;
    for (let i = 0; i <= 50; i++) velocity = motion.sample(i * 100, [i * 2, 0, -i]);
    expect(velocity?.[0]).toBeCloseTo(20, 6);
    expect(velocity?.[2]).toBeCloseTo(-10, 6);
    expect(motion.sample(5200, [10_000, 0, 0])).toBeUndefined();
  });
});

describe('extrapolateTrack', () => {
  it('moves along the velocity and keeps above the floor', () => {
    expect(extrapolateTrack([0, 100, 0], [10, -5, 2], [10, 30], { minY: 0 })).toEqual([
      { seconds: 10, position: [100, 50, 20] },
      { seconds: 30, position: [300, 0, 60] },
    ]);
  });
});

describe('earthPrefetchTargets', () => {
  it('maps tiles to the reads each layer makes', () => {
    const targets = earthPrefetchTargets(
      [
        { level: 13, x: 100, z: 200 },
        { level: 6, x: 3, z: 4 },
      ],
      {
        elevation: { maxLevel: 12 },
        landcover: { minLevel: 0, maxLevel: 13 },
        features: { minLevel: 4, maxLevel: 14 },
        buildingDetail: { level: 15, maxDepth: 2 },
      },
    );
    const byRole = (role: string) => targets.filter((target) => target.role === role);
    // Elevation stops at the archive's finest level: the z13 tile reads its z12 parent.
    expect(byRole('elevation')).toEqual([
      { role: 'elevation', level: 12, x: 50, y: 100 },
      { role: 'elevation', level: 6, x: 3, y: 4 },
    ]);
    // Landcover covers its finest three levels only.
    expect(byRole('landcover')).toEqual([{ role: 'landcover', level: 13, x: 100, y: 200 }]);
    expect(byRole('features')).toHaveLength(2);
    // Building detail: the sixteen z15 tiles under the z13 feature tile.
    const detail = byRole('buildingDetail');
    expect(detail).toHaveLength(16);
    expect(detail[0]).toEqual({ role: 'buildingDetail', level: 15, x: 400, y: 800 });
  });

  it('flips rows for TMS packages and reads each tile once', () => {
    const targets = earthPrefetchTargets(
      [
        { level: 3, x: 1, z: 2 },
        { level: 3, x: 1, z: 2 },
      ],
      { elevation: { maxLevel: 10 } },
      'tms',
    );
    expect(targets).toEqual([{ role: 'elevation', level: 3, x: 1, y: 5 }]);
  });
});

describe('createEarthPrefetcher', () => {
  /** Drive the camera east at `speed` m/s for `seconds`, one sample per 100 ms. */
  function fly(
    target: ReturnType<typeof prefetcher>,
    seconds: number,
    speed = 200,
    start = { latitude: 47.6, longitude: -122.33 },
  ) {
    const origin = world(start.latitude, start.longitude, 500);
    for (let t = 0; t <= seconds * 1000; t += 100) {
      const position = [origin[0] + (speed * t) / 1000 / metersPerUnit, origin[1], origin[2]];
      target.frame(t, position, [1, -0.3, 0]);
    }
    return origin;
  }

  it('reads tiles ahead of a moving camera, two at a time', async () => {
    const reads: Array<{ level: number; x: number; y: number }> = [];
    const target = prefetcher({}, reads);
    fly(target, 3);
    await vi.waitFor(() => expect(target.stats().warmed).toBeGreaterThan(10));
    expect(target.stats().lookAheads).toBeGreaterThan(0);
    expect(target.stats().inFlight).toBeLessThanOrEqual(2);
    // East of the start: the start's column at each level is the western limit of what was read.
    const startColumn = (level: number) => Math.floor(((-122.33 + 180) / 360) * 2 ** level);
    const ahead = reads.filter((read) => read.x > startColumn(read.level)).length;
    expect(ahead / reads.length).toBeGreaterThan(0.6);
    target.dispose();
  });

  it('stays idle while stationary, while the stream is saturated, and on Save-Data', async () => {
    const reads: Array<{ level: number; x: number; y: number }> = [];
    const still = prefetcher({}, reads);
    fly(still, 3, 0);
    expect(still.stats().paused).toBe('stationary');
    const saturated = prefetcher({ busy: () => true }, reads);
    fly(saturated, 3);
    expect(saturated.stats().paused).toBe('loading');
    vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
    const saving = prefetcher({}, reads);
    fly(saving, 3);
    expect(saving.stats().paused).toBe('saveData');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads).toEqual([]);
  });

  it('waits while the camera animates, and caps how far a fast camera looks', async () => {
    const reads: Array<{ level: number; x: number; y: number }> = [];
    const animating = prefetcher({}, reads);
    const origin = world(47.6, -122.33, 500);
    for (let t = 0; t <= 3000; t += 100) {
      // A fly-to at 2 km/s: far faster than any travel, and not travel at all.
      animating.frame(
        t,
        [origin[0] + (2 * t) / metersPerUnit, origin[1], origin[2]],
        [1, 0, 0],
        false,
      );
    }
    expect(animating.stats().paused).toBe('animating');
    expect(animating.stats().lookAheads).toBe(0);

    // The same speed as steady travel looks at most maxDistanceMeters ahead.
    const capped = prefetcher({ options: { maxDistanceMeters: 5_000 } }, reads);
    fly(capped, 3, 2000);
    await vi.waitFor(() => expect(capped.stats().warmed).toBeGreaterThan(0));
    // 5 km past the start (plus the 6 km the camera covered) stays within a few z12 columns.
    const startColumn = Math.floor(((-122.33 + 180) / 360) * 2 ** 12);
    const columns = reads.filter((read) => read.level === 12).map((read) => read.x);
    expect(columns.length).toBeGreaterThan(0);
    const farthest = Math.max(...columns);
    expect(farthest - startColumn).toBeLessThan(6);
    capped.dispose();
  });

  it('skips resident tiles and reads host points first, even while the stream is busy', async () => {
    const reads: Array<{ level: number; x: number; y: number }> = [];
    const target = prefetcher({ busy: () => true }, reads);
    const destination = world(47.7, -122.2);
    const result = await target.enqueue([destination]);
    expect(result.requested).toBeGreaterThan(0);
    expect(result.warmed).toBe(result.requested);
    expect(reads).toHaveLength(result.requested);
    // The same place again: recently read, nothing new.
    expect((await target.enqueue([destination])).requested).toBe(0);
    target.dispose();
  });

  it('resolves pending host points when disposed', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const target = prefetcher();
    const pending = target.enqueue([world(47.7, -122.2)]);
    target.dispose();
    const result = await pending;
    expect(result.warmed).toBe(0);
    expect(result.failed).toBe(result.requested);
  });
});
