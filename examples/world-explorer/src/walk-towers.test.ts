import { WalkCollision, WalkController } from '@bendyline/molen-client/navigation';
import { validateByKind } from '@bendyline/molen-schema';
import {
  buffersToObject3D,
  createVertexColorMaterialSet,
  InteriorStreamer,
} from '@bendyline/molen-worldgen/client';
import {
  type ArchStyleDoc,
  FLAT_GROUND,
  generateBuilding,
  generateInteriorPlan,
  type InteriorCatalogDoc,
  type InteriorSite,
  interiorToWorld,
  MeshBufferBuilder,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import interiorsRaw from '../../../content/worldgen/interiors/catalog.json?raw';
import skyscraperRaw from '../../../content/worldgen/styles/use/skyscraper.archstyle.json?raw';

const INTERIORS = JSON.parse(interiorsRaw) as InteriorCatalogDoc;

function styleOf(source: string): ArchStyleDoc {
  const result = validateByKind('archstyle', JSON.parse(source));
  if (!result.ok) throw new Error(result.formatted);
  return result.value as ArchStyleDoc;
}

function tower(): { scene: THREE.Group; region: THREE.Group; site: InteriorSite } {
  const outline: Vec2[] = [
    [0, 0],
    [44, 0],
    [44, 44],
    [0, 44],
  ];
  const builder = new MeshBufferBuilder();
  const result = generateBuilding(
    {
      request: {
        identity: 'tower',
        labels: ['skyscraper', 'building'],
        outline,
        height: 120,
        interiorLabels: ['skyscraper'],
      },
      style: styleOf(skyscraperRaw),
      pack: { name: 'test', version: '1' },
      ground: FLAT_GROUND,
      tier: 0,
      interiors: INTERIORS,
    },
    builder,
  );
  const site = result.record?.interior;
  if (!site) throw new Error('No site');
  const scene = new THREE.Group(),
    region = new THREE.Group();
  scene.add(region);
  region.add(buffersToObject3D(builder.finalize(), createVertexColorMaterialSet()));
  return { scene, region, site };
}

const idle = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };

describe('riding a lift', () => {
  it('walks in, rides up, stands on a floor that did not exist yet, and comes back down', () => {
    const { scene, region, site } = tower();
    const streamer = new InteriorStreamer({ catalog: INTERIORS, frameBudgetMs: 1000 });
    streamer.register(region, [site]);
    const settle = (at: THREE.Vector3): void => {
      for (let i = 0; i < 60; i++) streamer.update([at.x, at.y + 1.7, at.z]);
    };
    const plan = generateInteriorPlan(site, { catalog: INTERIORS });
    const car = plan.tower?.elevators[0];
    if (!car) throw new Error('No lift');
    const [x0, z0, x1, z1] = car.bounds;
    const inside = interiorToWorld(site, [(x0 + x1) / 2, (z0 + z1) / 2]);
    const lobby = interiorToWorld(site, [0, (z0 + z1) / 2]);

    const collision = new WalkCollision();
    const walker = new WalkController();
    const sample = (): number => 0;
    // Stand in the lobby, then walk straight into the open side of the car.
    walker.reset(lobby[0], lobby[1]);
    settle(new THREE.Vector3(lobby[0], 0, lobby[1]));
    expect(streamer.stats().resident).toBe(1);
    walker.feet.set(lobby[0], site.floor + 0.02, lobby[1]);
    walker.ready = true;
    walker.grounded = true;
    walker.waitingForTerrain = false;
    const yaw = Math.atan2(inside[0] - lobby[0], -(inside[1] - lobby[1])) - Math.PI / 2;
    const step = (input: typeof idle, frames: number): void => {
      for (let i = 0; i < frames; i++) {
        collision.update(scene, walker.feet.x, walker.feet.z);
        walker.update(1 / 60, input, collision, sample);
        streamer.update([walker.feet.x, walker.feet.y + 1.7, walker.feet.z]);
      }
    };
    collision.invalidate();
    step({ ...idle, forward: 1, yaw }, 120);
    const at = (): [number, number, number] => [walker.feet.x, walker.feet.y, walker.feet.z];
    const stop = streamer.elevatorAt(at());
    expect(stop, `stopped at ${at().map((v) => v.toFixed(1))}`).toBeDefined();
    expect(stop?.level).toBe(0);
    const floors = stop?.floors ?? [];
    expect(floors.length).toBeGreaterThan(20);

    // The twentieth floor is not built until asked for, and the walker waits until it is.
    const level = 20;
    const identity = stop?.identity as string;
    expect(streamer.requestStorey(identity, level)).toBe(false);
    for (let i = 0; i < 200 && !streamer.requestStorey(identity, level); i++)
      streamer.update([walker.feet.x, walker.feet.y + 1.7, walker.feet.z]);
    expect(streamer.requestStorey(identity, level)).toBe(true);
    const floor = floors[level] as number;
    walker.feet.y = floor + 0.02;
    walker.velocity.set(0, 0, 0);
    collision.invalidate();
    step(idle, 90);
    expect(walker.feet.y).toBeCloseTo(floor, 1);
    expect(walker.grounded).toBe(true);
    expect(streamer.elevatorAt(at())?.level).toBe(level);

    // Walk out onto the floor: it holds, and the streamer keeps it.
    step({ ...idle, forward: -1, yaw }, 120);
    expect(walker.feet.y).toBeCloseTo(floor, 1);
    expect(streamer.elevatorAt(at())).toBeUndefined();

    // Back into the car and down: the ground floor is always built.
    step({ ...idle, forward: 1, yaw }, 130);
    const back = streamer.elevatorAt(at());
    expect(back).toBeDefined();
    expect(streamer.requestStorey(identity, 0)).toBe(true);
    walker.feet.y = site.floor + 0.02;
    walker.velocity.set(0, 0, 0);
    collision.invalidate();
    step(idle, 60);
    expect(walker.feet.y).toBeCloseTo(site.floor, 1);
    streamer.dispose();
  });
});
