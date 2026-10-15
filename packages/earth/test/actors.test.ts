// Actors in a mounted Earth view (the stand-in viewer and flat terrain of view-harness): following
// the walker, teleporting, walking to a place, boarding and leaving an owned car, surviving a
// re-anchor, the interact key, and the viewer's own avatar with the third-person camera. The last
// case drives the director against an ambient world directly to adopt pedestrians.

import { componentHandle, Transform, World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EarthActorDirector } from '../src/client/actors';
import { EarthAmbient } from '../src/client/ambient';
import type { EarthContent } from '../src/client/content';
import type { EarthView } from '../src/client/earth-view';
import { ENTITY_TYPES } from './entity-types';
import {
  FLAT_ARCHIVE,
  FLAT_EARTH,
  fakeCanvas,
  pump,
  settle,
  stubFrameGlobals,
} from './view-harness';

vi.mock('@bendyline/molen-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bendyline/molen-client')>();
  const { stubCreateViewer } = await import('./view-harness');
  return { ...actual, applyEnvironment: () => {}, createViewer: stubCreateViewer(actual) };
});

const { mountEarthView } = await import('../src/client/earth-view');

beforeEach(stubFrameGlobals);
afterEach(() => vi.unstubAllGlobals());

const SEDAN = 'molen.entities.vehicle.sedan';
const PERSON = { preset: 'human.adult' as const, height: 1.72 };
const START = { latitude: 47.6, longitude: -122.33 };

async function mountView(options: { interaction?: { pedestrians?: boolean } } = {}) {
  const content = {
    packs: {
      readBytes: async () => {
        throw new Error('no models in unit tests');
      },
    },
    types: ENTITY_TYPES,
    parkedVehicles: [],
    assets: { load: async () => new Uint8Array(), loadText: async () => '' },
    stars: async () => [],
  } as unknown as EarthContent;
  const view = await mountEarthView({
    canvas: fakeCanvas() as unknown as HTMLCanvasElement,
    terrain: FLAT_EARTH,
    archives: { elevation: FLAT_ARCHIVE },
    content,
    audio: false,
    ambient: false,
    camera: { ...START, range: 2_000, heading: 0 },
    style: { sky: false },
    ...options,
  });
  const changes: string[] = [];
  view.on('actorchange', ({ id, change, reason }) =>
    changes.push(`${id}:${change}${reason !== undefined ? `:${reason}` : ''}`),
  );
  return { view, changes };
}

/** Walk mode at START facing north; returns the walker's world X/Z. */
async function startWalking(view: EarthView): Promise<[number, number]> {
  await pump(10);
  view.setMode('walk', { at: { ...START, heading: 0 } });
  await pump(30);
  const here = view.walker.pose();
  if (here === undefined) throw new Error('not walking');
  return view.toWorld(here.latitude, here.longitude);
}

/** World X/Z of anything with a latitude and longitude. */
function at(view: EarthView, place: { latitude: number; longitude: number }): [number, number] {
  return view.toWorld(place.latitude, place.longitude);
}

function apart(
  view: EarthView,
  a: { latitude: number; longitude: number } | undefined,
  b: { latitude: number; longitude: number } | undefined,
): number {
  if (a === undefined || b === undefined) return Number.NaN;
  const [ax, az] = at(view, a);
  const [bx, bz] = at(view, b);
  return Math.hypot(ax - bx, az - bz);
}

/** Pump frames until `done` holds (or `limit` frames pass). */
async function until(done: () => boolean, limit = 600): Promise<void> {
  for (let i = 0; i < limit && !done(); i++) await pump(1);
}

/** Visible animated figures the actors draw (the avatar included). */
function drawnFigures(view: EarthView): number {
  let count = 0;
  view.viewer.renderer.scene.traverse((object) => {
    if (object.name !== 'ambient:figures') return;
    object.traverseVisible((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) count++;
    });
  });
  return count;
}

describe('Earth view actors', () => {
  it('follows the walker at a distance and jogs to catch up', async () => {
    const { view, changes } = await mountView();
    const [x, z] = await startWalking(view);
    const id = view.actors.add({
      id: 'guide',
      figure: PERSON,
      ...view.toGeo(x, z + 6), // 6 m behind (south of) the walker
      behaviour: { kind: 'follow', target: 'viewer' },
    });
    expect(changes).toContain('guide:added');
    await pump(3);
    expect(view.actors.pose(id)?.placed).toBe(true);
    expect(drawnFigures(view)).toBe(1);
    // Walk north for three seconds, stop, and let the follower close in.
    view.input.map.press('KeyW');
    await pump(190);
    view.input.map.release('KeyW');
    await pump(260);
    const walker = view.walker.pose();
    const guide = view.actors.pose(id);
    expect(apart(view, walker, guide)).toBeGreaterThan(1.8);
    expect(apart(view, walker, guide)).toBeLessThan(3.2);
    if (walker === undefined || guide === undefined) throw new Error('missing pose');
    expect(at(view, walker)[1]).toBeLessThan(z - 3); // the walker went north
    expect(at(view, guide)[1]).toBeGreaterThan(at(view, walker)[1]); // and the guide is behind
    expect(guide.mode).toBe('idle');
    expect(guide.behaviour).toBe('follow');
    // Twenty meters ahead: the guide jogs, then settles at its distance again.
    const [wx, wz] = at(view, walker);
    view.walker.place(view.toGeo(wx, wz - 20));
    await until(() => view.actors.pose(id)?.mode === 'run', 120);
    expect(view.actors.pose(id)?.mode).toBe('run');
    expect(view.actors.pose(id)?.speed ?? 0).toBeGreaterThan(2.5);
    await pump(400);
    expect(apart(view, view.walker.pose(), view.actors.pose(id))).toBeLessThan(3.2);
    expect(changes.filter((change) => change.includes('stuck'))).toEqual([]);
    view.dispose();
  });

  it('teleports a follower left too far behind', async () => {
    const { view, changes } = await mountView();
    const [x, z] = await startWalking(view);
    view.actors.add({
      id: 'lagging',
      figure: PERSON,
      ...view.toGeo(x + 30, z + 30),
      behaviour: { kind: 'follow', target: 'viewer', teleportBeyond: 20 },
    });
    await until(() => changes.includes('lagging:teleported'), 30);
    expect(changes).toContain('lagging:teleported');
    const pose = view.actors.pose('lagging');
    expect(apart(view, view.walker.pose(), pose)).toBeCloseTo(2.5, 0);
    // Behind a walker facing north is south of it.
    if (pose === undefined) throw new Error('missing pose');
    expect(at(view, pose)[1]).toBeGreaterThan(z + 1.5);
    view.dispose();
  });

  it('walks to a place, reports arriving, and turns to its heading', async () => {
    const { view, changes } = await mountView();
    const [x, z] = await startWalking(view);
    const target = { ...view.toGeo(x + 6, z - 2), heading: Math.PI };
    view.actors.add({
      id: 'courier',
      figure: PERSON,
      ...view.toGeo(x + 1, z + 2),
      behaviour: { kind: 'goTo', to: target, arriveWithin: 0.5 },
    });
    await pump(20);
    expect(view.actors.pose('courier')?.mode).toBe('walk');
    await until(() => changes.includes('courier:arrived'));
    expect(changes).toContain('courier:arrived');
    await pump(60);
    const pose = view.actors.pose('courier');
    expect(apart(view, pose, target)).toBeLessThan(0.6);
    expect(pose?.behaviour).toBe('idle');
    expect(pose?.heading).toBeCloseTo(Math.PI, 1);
    view.dispose();
  });

  it('waits when the viewer drives off, boards a passenger seat, rides along and alights', async () => {
    const { view, changes } = await mountView();
    const [x, z] = await startWalking(view);
    // A car 6 m ahead, nose north; a companion following the walker.
    const car = view.vehicles.spawn({
      id: 'car-1',
      type: SEDAN,
      ...view.toGeo(x, z - 6),
      heading: 0,
    });
    await view.vehicles.whenPlaced(car);
    view.actors.add({
      id: 'rider',
      figure: PERSON,
      ...view.toGeo(x + 2, z + 1),
      behaviour: { kind: 'follow', target: 'viewer' },
    });
    await pump(5);
    expect(view.vehicles.board(car, { force: true })).toBe(true);
    await pump(5);
    expect(changes).toContain('rider:stuck:target-mounted');
    expect(changes.filter((change) => change === 'rider:stuck:target-mounted')).toHaveLength(1);
    // The host has the companion climb in beside the driver.
    view.actors.setBehaviour('rider', { kind: 'board', vehicle: car });
    await until(() => changes.includes('rider:boarded'));
    let rider = view.actors.pose('rider');
    expect(rider?.mounted).toEqual({ vehicle: car, seat: 'passenger' });
    expect(rider?.mode).toBe('sit');
    expect(rider?.behaviour).toBe('idle');
    const parked = view.vehicles.pose(car);
    // Drive north for two seconds: the passenger goes along.
    view.input.map.press('KeyW');
    await pump(120);
    view.input.map.release('KeyW');
    const moving = view.vehicles.pose(car);
    rider = view.actors.pose('rider');
    expect(apart(view, parked, moving)).toBeGreaterThan(4);
    expect(apart(view, moving, rider)).toBeLessThan(1.5);
    expect(rider?.speed ?? 0).toBeGreaterThan(1);
    // Leaving a moving car waits for it to stop.
    view.actors.setBehaviour('rider', { kind: 'alight' });
    await pump(3);
    expect(changes).toContain('rider:stuck:moving');
    view.input.map.press('Space');
    await until(() => Math.abs(view.vehicles.pose(car)?.speed ?? 1) < 0.05, 400);
    view.input.map.release('Space');
    await until(() => changes.includes('rider:alighted'), 120);
    rider = view.actors.pose('rider');
    expect(rider?.mounted).toBeUndefined();
    expect(rider?.mode).toBe('idle');
    expect(rider?.altitude).toBeCloseTo(100, 0);
    const stopped = view.vehicles.pose(car);
    const beside = apart(view, stopped, rider);
    expect(beside).toBeGreaterThan(1);
    expect(beside).toBeLessThan(2.5);
    // The driver is still at the wheel.
    expect(view.mode).toBe('drive');
    expect(view.vehicles.pose(car)?.occupied).toBe(true);
    view.dispose();
  });

  it('keeps actors through a long re-anchor, seated ones back in their seats', async () => {
    const { view, changes } = await mountView();
    await pump(10);
    const stay = { latitude: 47.6005, longitude: -122.3301, heading: 1 };
    view.actors.add({ id: 'stay', figure: PERSON, ...stay });
    const car = view.vehicles.spawn({
      id: 'car-9',
      type: SEDAN,
      latitude: 47.6008,
      longitude: -122.3304,
      heading: 0,
    });
    await view.vehicles.whenPlaced(car);
    view.actors.add({ id: 'seated', figure: PERSON, latitude: 47.601, longitude: -122.3304 });
    await pump(3);
    view.actors.setBehaviour('seated', { kind: 'board', vehicle: car, force: true });
    expect(changes).toContain('seated:boarded');
    expect(view.actors.pose('seated')?.mounted).toEqual({ vehicle: car, seat: 'passenger' });
    view.flyTo({ latitude: 40.7, longitude: -74.0, range: 3_000 }, { durationMs: 300 });
    await pump(40);
    await settle(view);
    await pump(5);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    const away = view.actors.pose('stay');
    expect(away?.placed).toBe(false);
    expect(away?.latitude).toBeCloseTo(stay.latitude, 6);
    expect(away?.longitude).toBeCloseTo(stay.longitude, 6);
    expect(view.actors.pose('seated')?.mounted?.vehicle).toBe(car);
    view.flyTo({ ...START, range: 2_000 }, { durationMs: 300 });
    await pump(40);
    await settle(view);
    await pump(30);
    const back = view.actors.pose('stay');
    expect(back?.placed).toBe(true);
    expect(back?.latitude).toBeCloseTo(stay.latitude, 6);
    expect(back?.heading).toBeCloseTo(1, 3);
    const seated = view.actors.pose('seated');
    expect(seated?.placed).toBe(true);
    expect(seated?.mounted).toEqual({ vehicle: car, seat: 'passenger' });
    expect(seated?.mode).toBe('sit');
    expect(apart(view, seated, view.vehicles.pose(car))).toBeLessThan(1.5);
    // Removing the car leaves the passenger standing where it was.
    view.vehicles.remove(car);
    await until(() => changes.includes('seated:alighted:vehicle-gone'), 10);
    expect(view.actors.pose('seated')?.mounted).toBeUndefined();
    expect(view.actors.pose('seated')?.altitude).toBeCloseTo(100, 0);
    view.actors.remove('stay');
    expect(changes).toContain('stay:removed');
    expect(view.actors.list()).toEqual(['seated']);
    view.dispose();
  });

  it('offers interactable actors to the interact key and lets the host claim it', async () => {
    const { view } = await mountView();
    const [x, z] = await startWalking(view);
    view.actors.add({
      id: 'talker',
      figure: PERSON,
      ...view.toGeo(x, z - 1.6),
      interactable: true,
    });
    view.actors.add({ id: 'shy', figure: PERSON, ...view.toGeo(x + 1, z) });
    await pump(3);
    const found = view.interactable();
    expect(found.kind).toBe('actor');
    expect(found.id).toBe('talker');
    expect(found.distance ?? Infinity).toBeLessThan(2.5);
    const seen: string[] = [];
    const off = view.on('interact', (interaction) => {
      seen.push(`${interaction.kind}:${interaction.id ?? ''}`);
      interaction.claim();
    });
    view.input.map.press('KeyE');
    view.input.map.release('KeyE');
    await pump(1);
    expect(seen).toEqual(['actor:talker']);
    off();
    // Unclaimed, nothing happens: the view does not board or leave anything.
    view.input.map.press('KeyE');
    view.input.map.release('KeyE');
    await pump(1);
    expect(view.mode).toBe('walk');
    // The reach changes at run time: a shorter one leaves the talker out of reach.
    view.setInteraction({ reach: 1 });
    expect(view.interactable()).toEqual({ kind: 'none' });
    view.setInteraction({ reach: 2.5 });
    expect(view.interactable().id).toBe('talker');
    view.actors.setInteractable('talker', false);
    expect(view.interactable()).toEqual({ kind: 'none' });
    // Looking at the viewer behind it, the talker turns around (the head does the last bit).
    expect(view.actors.pose('talker')?.heading).toBeCloseTo(0, 3);
    view.actors.lookAt('talker', 'viewer');
    await pump(90);
    expect(Math.abs((view.actors.pose('talker')?.heading ?? 0) - Math.PI)).toBeLessThan(1.6);
    expect(view.actors.pose('talker')?.mode).toBe('idle');
    view.dispose();
  });

  it('gives the walker a body and a third-person camera that V toggles', async () => {
    const { view } = await mountView();
    await startWalking(view);
    const first = view.getCamera();
    expect(first.range).toBeCloseTo(1.7, 1);
    expect(view.walker.view).toBe('first');
    // Without an avatar V keeps the first-person view.
    view.input.map.press('KeyV');
    view.input.map.release('KeyV');
    await pump(2);
    expect(view.walker.view).toBe('first');
    expect(drawnFigures(view)).toBe(0);
    view.walker.setAvatar({ figure: PERSON });
    view.walker.setView('third');
    await pump(20);
    const third = view.getCamera();
    expect(third.range).toBeGreaterThan(3.5);
    expect(third.altitude).toBeGreaterThan(first.altitude + 0.1);
    // Behind a walker facing north is south (+Z) of its feet.
    const feet = view.walker.pose();
    if (feet === undefined) throw new Error('not walking');
    expect(view.viewer.renderer.camera.position.z).toBeGreaterThan(at(view, feet)[1] + 3);
    expect(drawnFigures(view)).toBe(1);
    view.input.map.press('KeyV');
    view.input.map.release('KeyV');
    await pump(2);
    expect(view.walker.view).toBe('first');
    expect(view.getCamera().range).toBeCloseTo(1.7, 1);
    expect(drawnFigures(view)).toBe(0);
    view.input.map.press('KeyV');
    view.input.map.release('KeyV');
    await pump(2);
    expect(view.walker.view).toBe('third');
    // An avatar type must carry a figure.
    expect(() => view.walker.setAvatar({ type: SEDAN })).toThrow(/no figure/);
    view.walker.setAvatar(undefined);
    await pump(2);
    expect(drawnFigures(view)).toBe(0);
    view.dispose();
  });
});

describe('EarthActorDirector with ambient life', () => {
  const AmbientAgent = componentHandle('ambientAgent');
  const Marker = componentHandle('earthActor');
  const viewer = { position: undefined, heading: 0, vehicle: undefined, eye: undefined };

  it('adopts pedestrians where they stand and strolls the footways', () => {
    const world = new World({ tickRate: 60, seed: 'adopt' });
    const root = new THREE.Group();
    const ambient = new EarthAmbient({
      world,
      parent: root,
      settings: { cars: false, rail: false, aircraft: false, density: 1 },
    });
    ambient.setBudget({
      cars: 0,
      pedestrians: 12,
      trains: 0,
      aircraft: 0,
      detailedCars: 0,
      skinnedFigures: 8,
      figureRadius: 150,
      activityRadius: 600,
      posesPerFrame: 8,
    });
    ambient.handle.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          id: 'promenade',
          class: 'path',
          subclass: 'footway',
          points: [
            [-160, 0],
            [160, 0],
          ],
        },
      ],
    });
    ambient.handle.setObserver({ pos: [0, 0, 0] });
    world.stepN(300);
    const pedestrians = ambient.handle
      .agentsNear(0, 0, 200, 'pedestrian')
      .sort(
        (a, b) =>
          Math.abs(world.get(a, Transform)?.pos[0] ?? 0) -
          Math.abs(world.get(b, Transform)?.pos[0] ?? 0),
      );
    expect(pedestrians.length).toBeGreaterThan(1);
    const changes: string[] = [];
    // A toy projection: 1e-5 degrees per meter, north -Z. All actors move over bare terrain.
    const director = new EarthActorDirector(
      {
        toWorld: (latitude, longitude) => [longitude * 1e5, -latitude * 1e5],
        toGeo: (x, z) => ({ latitude: -z / 1e5, longitude: x / 1e5 }),
        groundHeight: () => 0,
        emit: ({ id, change }) => changes.push(`${id}:${change}`),
      },
      { maxActive: 0 },
    );
    director.attach({ world, root, ambient: ambient.handle });
    let now = 0;
    const frames = (count: number): void => {
      for (let i = 0; i < count; i++) {
        world.step();
        now += 1000 / 60;
        director.update(1 / 60, now, [0, 2, 0], viewer, { visible: false });
        ambient.render([0, 2, 0], 1 / 60);
      }
    };
    const first = pedestrians[0] as string;
    const before = [...(world.get(first, Transform)?.pos ?? [])];
    expect(director.api.adopt(first)).toBe(first);
    expect(world.has(first, AmbientAgent)).toBe(false);
    expect(world.has(first, Marker)).toBe(true);
    frames(60);
    // Ambient life no longer moves or draws it; it stands where it was adopted.
    expect(world.get(first, Transform)?.pos[0]).toBeCloseTo(before[0] as number, 3);
    expect(ambient.handle.agentsNear(0, 0, 400, 'pedestrian')).not.toContain(first);
    const pose = director.api.pose(first);
    expect(pose?.behaviour).toBe('idle');
    expect(pose?.placed).toBe(true);
    // Under a new id, wandering around where it stands.
    const second = pedestrians[1] as string;
    const start = [...(world.get(second, Transform)?.pos ?? [])] as [number, number, number];
    const home = { latitude: -start[2] / 1e5, longitude: start[0] / 1e5 };
    expect(
      director.api.adopt(second, {
        id: 'stroller',
        behaviour: { kind: 'wander', around: home, radius: 25 },
        interactable: false,
      }),
    ).toBe('stroller');
    expect(world.exists(second)).toBe(false);
    expect(world.exists('stroller')).toBe(true);
    expect(changes).toEqual([`${first}:added`, 'stroller:added']);
    let travelled = 0;
    let last = start;
    for (let second = 0; second < 30; second++) {
      frames(60);
      const pos = world.get('stroller', Transform)?.pos ?? last;
      travelled += Math.hypot(pos[0] - last[0], pos[2] - last[2]);
      last = [pos[0], pos[1], pos[2]];
      // On the promenade, near home.
      expect(Math.abs(pos[2])).toBeLessThan(4);
      expect(Math.abs(pos[0] - start[0])).toBeLessThan(25 * 1.25 + 1);
    }
    expect(travelled).toBeGreaterThan(5);
    // A pedestrian that is gone (or never was) cannot be adopted.
    expect(director.api.adopt('ambient:pedestrian:nobody')).toBeUndefined();
    expect(director.api.adopt('stroller')).toBeUndefined();
    director.dispose();
    ambient.dispose();
  });
});
