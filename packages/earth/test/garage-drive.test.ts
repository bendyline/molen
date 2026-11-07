import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform } from '@bendyline/molen-kernel/world';
import type { VehicleData, VehiclePlacement } from '@bendyline/molen-schema';
import { tagTerrainObject } from '@bendyline/molen-terrain/client';
import type { TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  buffersToObject3D,
  createVertexColorMaterialSet,
  InteriorStreamer,
} from '@bendyline/molen-worldgen/client';
import {
  FLAT_GROUND,
  generateWorldgenBatch,
  type InteriorSite,
  interiorToLocal,
  interiorToWorld,
  type MeshBuffers,
  type ResolvedStylePack,
  resolveStylePackDocuments,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import { semanticTileToBatch } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGarageFurnisher } from '../src/client/garage-cars';
import { EarthVehicles } from '../src/client/vehicles';
import { ENTITY_TYPES } from './entity-types';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const PACK = resolve(repository, 'content/worldgen');
const fixturePath = (name: string): string =>
  resolve(repository, `packages/worldgen-earth/test/fixtures/${name}.semantic.json`);
const BELLEVUE = { fixture: 'bellevue-square-parking', x: 5260, z: 11442 };
const DOWNTOWN = { fixture: 'seattle-downtown-parking', x: 5248, z: 11443 };
const SOUTHEAST = { ...BELLEVUE, id: '35184406129138' };
const NORTHEAST = { ...BELLEVUE, id: '35184534018354' };
const SORREANO = { ...DOWNTOWN, id: '35184545429892' };
const OLYMPIC = { ...DOWNTOWN, id: '35184604169127' };
const CAR = 'molen.entities.vehicle.sedan';

async function loadGarage(place: typeof SOUTHEAST) {
  const { id } = place;
  const fixture = JSON.parse(await readFile(fixturePath(place.fixture), 'utf8')) as {
    size: number;
    tile: TerrainSemanticTile;
  };
  const pack: ResolvedStylePack = await resolveStylePackDocuments(
    JSON.parse(await readFile(resolve(PACK, 'stylepack.json'), 'utf8')),
    async (path: string) => JSON.parse(await readFile(resolve(PACK, path), 'utf8')),
  );
  const geom = {
    level: 15,
    x: place.x,
    z: place.z,
    originX: 0,
    originZ: 0,
    size: fixture.size,
    metersPerUnit: 1,
    levelBelowMax: 0,
  };
  const batch = semanticTileToBatch(fixture.tile, geom, { pack }, FLAT_GROUND);
  const output = generateWorldgenBatch({
    ...batch,
    buildings: batch.buildings.filter((b) => b.identity.includes(id)),
    ground: FLAT_GROUND,
    interiors: true,
  });
  const site = output.records.find((r) => r.interior?.parking)?.interior;
  if (!site || !pack.interiors || !output.buildings) throw new Error('no garage generated');
  return { site, catalog: pack.interiors, shell: output.buildings as MeshBuffers };
}

/**
 * The way from the door to the first ramp's mouth on the ground deck, found rather than scripted:
 * Dijkstra over the free drive lanes on a one-meter grid, preferring their middle.
 */
function waysIn(site: InteriorSite, from: Vec2, to: Vec2): Vec2[] {
  const layout = site.parking;
  if (!layout) throw new Error('not a garage');
  const open = [...layout.aisles, ...layout.crossAisles, ...layout.clear];
  const lanes = layout.ramps.map((ramp) => ramp.bounds);
  const within = (r: readonly number[], x: number, z: number): boolean =>
    x >= (r[0] as number) &&
    x <= (r[2] as number) &&
    z >= (r[1] as number) &&
    z <= (r[3] as number);
  const free = (x: number, z: number): boolean =>
    open.some((r) => within(r, x, z)) && !lanes.some((r) => within(r, x, z));
  const key = (x: number, z: number): string => `${x}:${z}`;
  const grid = (v: number): number => Math.round(v);
  const clearance = (x: number, z: number): number => {
    for (let d = 1; d <= 3; d++)
      for (const [dx, dz] of [
        [d, 0],
        [-d, 0],
        [0, d],
        [0, -d],
      ] as const)
        if (!free(x + dx, z + dz)) return d;
    return 4;
  };
  const start: Vec2 = [grid(from[0]), grid(from[1])],
    goal: Vec2 = [grid(to[0]), grid(to[1])];
  const distance = new Map<string, number>([[key(...start), 0]]);
  const previous = new Map<string, Vec2>();
  const queue: { at: Vec2; cost: number }[] = [{ at: start, cost: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { at, cost } = queue.shift() as { at: Vec2; cost: number };
    if (at[0] === goal[0] && at[1] === goal[1]) break;
    if (cost > (distance.get(key(...at)) ?? Infinity)) continue;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const x = at[0] + dx,
        z = at[1] + dz;
      if (!free(x, z)) continue;
      const step = Math.hypot(dx, dz) * (1 + (4 - clearance(x, z)) * 1.5);
      const next = cost + step;
      if (next < (distance.get(key(x, z)) ?? Infinity)) {
        distance.set(key(x, z), next);
        previous.set(key(x, z), at);
        queue.push({ at: [x, z], cost: next });
      }
    }
  }
  if (!distance.has(key(...goal))) throw new Error('no way from the door to the ramp');
  const cells: Vec2[] = [goal];
  for (let at = previous.get(key(...goal)); at; at = previous.get(key(...at))) cells.unshift(at);
  return cells.filter((_, index) => index % 3 === 0);
}

/** A drive from outside the first door, up every ramp, swinging across the aisle between them. */
function route(site: InteriorSite): { path: Vec2[]; arrivals: number[] } {
  const layout = site.parking;
  if (!layout) throw new Error('not a garage');
  const along = layout.axis === 'x';
  const point = (u: number, v: number): Vec2 => (along ? [u, v] : [v, u]);
  const uv = (u: number, v: number): Vec2 => interiorToWorld(site, point(u, v));
  const across = (r: readonly number[]): [number, number] =>
    along ? [r[1] as number, r[3] as number] : [r[0] as number, r[2] as number];
  const length = (r: readonly number[]): [number, number] =>
    along ? [r[0] as number, r[2] as number] : [r[1] as number, r[3] as number];
  const first = layout.ramps[0];
  const second = layout.ramps[1];
  if (!first) throw new Error('no ramps');
  const center = (r: readonly number[]): number => (across(r)[0] + across(r)[1]) / 2;
  const middle = second
    ? (center(first.bounds) + center(second.bounds)) / 2
    : center(first.bounds) - (layout.aisleWidth + layout.stallDepth) / 2;
  const lowEnd = first.climb === 1 ? length(first.bounds)[0] : length(first.bounds)[1];
  const mouth = point(lowEnd - first.climb * 6, center(first.bounds));
  const path: Vec2[] = [
    interiorToWorld(site, [0, -9]),
    ...waysIn(site, [0, 1.5], mouth).map((p) => interiorToWorld(site, p)),
  ];
  const arrivals: number[] = [];
  for (const [index, ramp] of layout.ramps.entries()) {
    const [a, b] = length(ramp.bounds);
    const here = center(ramp.bounds);
    const low = ramp.climb === 1 ? a : b,
      high = ramp.climb === 1 ? b : a;
    path.push(uv(low - ramp.climb * 1.5, here), uv(low, here), uv(high, here));
    arrivals.push(path.length);
    if (index + 1 === layout.ramps.length) {
      path.push(uv(high + ramp.climb * 5, here));
      break;
    }
    // The U-turn onto the next lane, around the middle of the aisle.
    const radius = Math.abs(here - middle);
    for (const degrees of [30, 60, 90, 120, 150]) {
      const angle = (degrees * Math.PI) / 180;
      path.push(
        uv(
          high + ramp.climb * (0.6 + radius * Math.sin(angle)),
          middle + (here - middle) * Math.cos(angle),
        ),
      );
    }
  }
  return { path, arrivals };
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

function makeWorld(site: InteriorSite, shell: MeshBuffers, parked?: VehiclePlacement[]) {
  const scene = new THREE.Group(),
    tile = new THREE.Group();
  scene.add(tile);
  const materials = createVertexColorMaterialSet();
  tile.add(buffersToObject3D(shell, materials));
  const spec = ENTITY_TYPES.component<VehicleData>(CAR, 'vehicle').spec;
  const door = interiorToWorld(site, [0, -9]);
  const heading = interiorToWorld(site, [0, -8]);
  const yaw = Math.atan2(door[0] - heading[0], door[1] - heading[1]) + Math.PI;
  const car: VehiclePlacement = {
    id: 'driven',
    kind: CAR,
    color: '#914c40',
    spec,
    position: [door[0], 0, door[1]],
    yaw,
  };
  tile.userData.vehicles = [car, ...(parked ?? [])];
  tagTerrainObject('parked-vehicles', tile);
  const vehicles = new EarthVehicles({
    root: scene,
    sampleHeight: () => 0,
    loadModel: async () => new THREE.Group(),
    types: ENTITY_TYPES,
  });
  return { scene, tile, vehicles, door };
}

/** Pure pursuit along the route; returns the heights it reached and where it stopped. */
function drive(vehicles: EarthVehicles, path: Vec2[]) {
  const dt = 1 / 60;
  let next = 1;
  let peak = 0;
  let stuck = 0;
  const seen: { at: number; y: number }[] = [];
  for (let tick = 0; tick < 60 * 420 && next < path.length; tick++) {
    const id = vehicles.mountedId as string;
    const transform = vehicles.world.get(id, Transform);
    if (!transform) throw new Error('car vanished');
    const [x, y, z] = transform.pos;
    peak = Math.max(peak, y);
    const target = path[next] as Vec2;
    const dx = target[0] - x,
      dz = target[1] - z;
    if (Math.hypot(dx, dz) < 2.6) {
      next++;
      seen.push({ at: next, y });
      continue;
    }
    const [qx, qy, qz, qw] = transform.rot;
    const yaw = Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx));
    const error = wrap(Math.atan2(dx, dz) - yaw);
    const speed = vehicles.speed;
    stuck = Math.abs(speed) < 0.05 ? stuck + 1 : 0;
    if (stuck > 240) break;
    const wanted = Math.abs(error) > 0.5 ? 2.5 : 4;
    vehicles.update(dt, {
      throttle: Math.max(-1, Math.min(1, (wanted - speed) * 0.8)),
      // Positive steering is to the right; positive heading error is to the left.
      steering: Math.max(-1, Math.min(1, -error * 2.4)),
      brake: false,
    });
  }
  const id = vehicles.mountedId as string;
  return { reached: next, peak, end: vehicles.world.get(id, Transform)?.pos, seen };
}

function load(streamer: InteriorStreamer, position: [number, number, number]): void {
  for (let i = 0; i < 40_000 && streamer.stats().resident === 0; i++) streamer.update(position);
  expect(streamer.stats().resident).toBe(1);
}

describe('driving a mapped parking garage', () => {
  for (const [name, id] of [
    ['Southeast garage, 2 levels on a broad plate', SOUTHEAST],
    ['Northeast garage, 6 levels', NORTHEAST],
    ['Sorreano garage, 9 levels on a small downtown plate', SORREANO],
    ['Olympic garage, 8 levels downtown', OLYMPIC],
  ] as const)
    it(`drives from the street to the roof of the ${name}`, async () => {
      const { site, catalog, shell } = await loadGarage(id);
      const { scene, tile, vehicles, door } = makeWorld(site, shell);
      const streamer = new InteriorStreamer({ catalog, frameBudgetMs: 1000 });
      streamer.register(tile, [site], [0, 0]);
      load(streamer, [door[0], 1.5, door[1]]);
      vehicles.sync(0);
      expect(vehicles.enter([door[0] + 1.5, 1.7, door[1]])).toBe(true);
      const { path } = route(site);
      const result = drive(vehicles, path);
      const roof = site.storeys?.at(-1)?.floor ?? 0;
      const stopped = result.end ? interiorToLocal(site, [result.end[0], result.end[2]]) : [];
      expect(
        result.reached,
        `stopped at ${stopped.map((v) => v.toFixed(1))} y ${result.end?.[1].toFixed(1)} after ` +
          `${result.reached} of ${path.length}, heights ${result.seen.map((s) => s.y.toFixed(1)).join(' ')}`,
      ).toBe(path.length);
      expect(result.peak).toBeGreaterThan(roof - 0.1);
      expect(result.end?.[1]).toBeCloseTo(roof, 0);
      streamer.dispose();
      vehicles.dispose();
      scene.clear();
    }, 120_000);

  it('stays on the deck it is on, and steps out there rather than on the roof', async () => {
    const { site, catalog, shell } = await loadGarage(SOUTHEAST);
    const { tile, vehicles, door } = makeWorld(site, shell);
    const streamer = new InteriorStreamer({ catalog, frameBudgetMs: 1000 });
    streamer.register(tile, [site], [0, 0]);
    load(streamer, [door[0], 1.5, door[1]]);
    vehicles.sync(0);
    expect(vehicles.enter([door[0] + 1.5, 1.7, door[1]])).toBe(true);
    // Stop one deck up, under the roof, and get out.
    const { path, arrivals } = route(site);
    const result = drive(vehicles, path.slice(0, (arrivals[0] as number) + 2));
    const deck = site.storeys?.[1]?.floor ?? 0;
    expect(result.end?.[1]).toBeCloseTo(deck, 0);
    for (let i = 0; i < 300 && Math.abs(vehicles.speed) > 0.05; i++)
      vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: true });
    expect(result.end?.[1]).toBeLessThan((site.storeys?.at(-1)?.floor ?? 0) - 2);
    const feet = vehicles.exit();
    expect(feet).toBeDefined();
    expect(feet?.[1]).toBeCloseTo(deck, 0);
    streamer.dispose();
    vehicles.dispose();
  }, 120_000);

  it('parks cars that hide while a live one stands in, and go when the garage does', async () => {
    const { site, catalog, shell } = await loadGarage(SOUTHEAST);
    const { scene, tile, vehicles, door } = makeWorld(site, shell);
    const spec = ENTITY_TYPES.component<VehicleData>(CAR, 'vehicle').spec;
    const streamer = new InteriorStreamer({
      catalog,
      frameBudgetMs: 1000,
      furnish: createGarageFurnisher([{ id: CAR, spec }]),
    });
    streamer.register(tile, [site], [0, 0]);
    load(streamer, [door[0], 1.5, door[1]]);
    const group = tile.children.find((c) => c.name.startsWith('worldgen:interior:'));
    const near = group?.userData.vehiclesNear as
      | ((at: readonly [number, number, number]) => readonly VehiclePlacement[])
      | undefined;
    expect(near).toBeDefined();
    const live = near?.([door[0], 1, door[1]]) ?? [];
    expect(live.length).toBeGreaterThan(0);
    expect(live.length).toBeLessThanOrEqual(48);
    // A driver on the ground is not told about the cars on the deck over its head.
    expect(live.every((car) => Math.abs(car.position[1]) < 7)).toBe(true);
    vehicles.sync(0, [door[0], 1, door[1]]);
    const counted = [...vehicles.world.query(Transform)].length;
    expect(counted).toBeGreaterThan(live.length);
    streamer.update([100_000, 0, 100_000]);
    expect(tile.children.find((c) => c.name.startsWith('worldgen:interior:'))).toBeUndefined();
    vehicles.sync(performance.now() + 1000, [door[0], 1, door[1]]);
    expect([...vehicles.world.query(Transform)].length).toBeLessThan(counted);
    streamer.dispose();
    vehicles.dispose();
    scene.clear();
  }, 120_000);
});
