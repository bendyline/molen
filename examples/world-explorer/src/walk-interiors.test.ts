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
  interiorToLocal,
  interiorToWorld,
  MeshBufferBuilder,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import interiorsRaw from '../../../content/worldgen/interiors/catalog.json?raw';
import commercialRaw from '../../../content/worldgen/styles/generic/commercial.archstyle.json?raw';
import houseRaw from '../../../content/worldgen/styles/generic/house.archstyle.json?raw';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing generated fixture');
  return value;
}

const INTERIORS = JSON.parse(interiorsRaw) as InteriorCatalogDoc;

function styleOf(source: string): ArchStyleDoc {
  const result = validateByKind('archstyle', JSON.parse(source));
  if (!result.ok) throw new Error(result.formatted);
  return result.value as ArchStyleDoc;
}

describe('walkable generated interiors', () => {
  it('walks up the visible staircase, enters an upstairs bedroom, returns downstairs and exits', () => {
    const outline: Vec2[] = [
      [0, 0],
      [14, 0],
      [14, 14],
      [0, 14],
    ];
    const builder = new MeshBufferBuilder();
    const result = generateBuilding(
      {
        request: { identity: 'house-preview', outline, labels: ['building'], height: 9, levels: 2 },
        style: styleOf(houseRaw),
        pack: { name: 'test', version: '1' },
        ground: FLAT_GROUND,
        tier: 0,
        interiors: INTERIORS,
      },
      builder,
    );
    const site = required(result.record?.interior);
    const plan = generateInteriorPlan(site, { catalog: INTERIORS });
    expect(plan.profile).toBe('house');
    expect(plan.storeys).toHaveLength(2);
    const stair = required(plan.stairs[0]);
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const materials = createVertexColorMaterialSet();
    const shell = buffersToObject3D(builder.finalize(), materials);
    region.add(shell);
    for (const opening of site.openings) {
      const a = required(site.outline[opening.edge]),
        b = required(site.outline[(opening.edge + 1) % site.outline.length]);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
      const distance = (opening.start + opening.end) / 2;
      const ray = new THREE.Raycaster(
        new THREE.Vector3(
          a[0] + dx * distance + dz * 0.5,
          (opening.bottom + opening.top) / 2,
          a[1] + dz * distance - dx * 0.5,
        ),
        new THREE.Vector3(-dz, 0, dx),
      );
      expect(ray.intersectObject(shell)[0]?.distance ?? Infinity).toBeGreaterThan(0.6);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
    ground.rotation.x = -Math.PI / 2;
    region.add(ground);
    const stream = new InteriorStreamer({ frameBudgetMs: 50, catalog: INTERIORS });
    stream.register(region, [site]);
    const start = interiorToWorld(site, [0, -3]);
    for (let i = 0; i < 30; i++) stream.update([start[0], 1.7, start[1]]);
    expect(stream.stats().resident).toBe(1);
    const collision = new WalkCollision(),
      walker = new WalkController();
    collision.update(scene, ...start);
    walker.reset(...start);
    expect(walker.place(collision, () => 0)).toBe(true);
    const move = (x: number, z: number): void => {
      const target = interiorToWorld(site, [x, z]);
      for (let tick = 0; tick < 2400; tick++) {
        const dx = target[0] - walker.feet.x,
          dz = target[1] - walker.feet.z;
        if (Math.hypot(dx, dz) < 0.035) break;
        collision.update(scene, walker.feet.x, walker.feet.z);
        walker.update(
          1 / 120,
          { forward: 1, right: 0, yaw: Math.atan2(dz, dx), sprint: false, jump: false },
          collision,
          () => 0,
        );
      }
      const local = interiorToLocal(site, [walker.feet.x, walker.feet.z]);
      expect(local[0], `local X at ${x},${z}`).toBeCloseTo(x, 1);
      expect(local[1], `local Z at ${x},${z}`).toBeCloseTo(z, 1);
    };
    const sx = (stair.bounds[0] + stair.bounds[2]) / 2,
      end = stair.bounds[3] + 0.65;
    move(0, 0.75);
    move(sx, 0.75);
    move(sx, end);
    expect(walker.feet.y).toBeCloseTo(required(plan.storeys[1]).floor, 1);
    move(0, end);
    const bedroom = required(plan.rooms.find((r) => r.level === 1 && r.program === 'bedroom'));
    move(0, required(bedroom.door).at);
    move(-2.1, required(bedroom.door).at);
    expect(walker.feet.y).toBeCloseTo(required(plan.storeys[1]).floor, 1);
    move(0, required(bedroom.door).at);
    move(0, end);
    move(sx, end);
    move(sx, 0.75);
    expect(walker.feet.y).toBeCloseTo(site.floor, 1);
    move(0, 0.75);
    move(0, -3);
    expect(walker.feet.y).toBeLessThan(0.1);
    stream.dispose();
    materials.dispose?.();
  }, 20000);

  it.each([
    'house',
    'supermarket',
    'fast_food',
  ])('walks into and out of a %s through the actual shell opening', (label) => {
    const outline: Vec2[] = [
      [0, 0],
      [26, 0],
      [26, 24],
      [0, 24],
    ];
    const builder = new MeshBufferBuilder();
    const style = styleOf(label === 'house' ? houseRaw : commercialRaw);
    const result = generateBuilding(
      {
        request: {
          identity: 'walkthrough',
          outline,
          labels: [label],
          height: 6,
          levels: 1,
          ...(label === 'house'
            ? {}
            : {
                storefronts: [
                  {
                    identity: 'tenant',
                    at: [13, 24] as Vec2,
                    signModel: 'builtin:sign.grocery',
                    accent: '#b82b35',
                    width: 18,
                  },
                ],
              }),
        },
        style,
        pack: { name: 'walk-fixture', version: '1' },
        ground: FLAT_GROUND,
        tier: 0,
        interiors: INTERIORS,
      },
      builder,
    );
    const site = result.record?.interior;
    if (!site) throw new Error('No generated entrance');
    const scene = new THREE.Group(),
      region = new THREE.Group();
    scene.add(region);
    const materials = createVertexColorMaterialSet();
    region.add(buffersToObject3D(builder.finalize(), materials));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
    ground.rotation.x = -Math.PI / 2;
    region.add(ground);
    const stream = new InteriorStreamer({ frameBudgetMs: 50, catalog: INTERIORS });
    stream.register(region, [site]);
    const start: [number, number, number] = [
      site.entrance[0] - site.inward[0] * 3,
      1.7,
      site.entrance[1] - site.inward[1] * 3,
    ];
    const collision = new WalkCollision(),
      walker = new WalkController();
    collision.update(scene, start[0], start[2]);
    walker.reset(start[0], start[2]);
    expect(walker.place(collision, () => 0)).toBe(true);
    const yaw = Math.atan2(site.inward[1], site.inward[0]);
    const advance = (seconds: number, forward: number): void => {
      for (let i = 0; i < seconds * 120; i++) {
        collision.update(scene, walker.feet.x, walker.feet.z);
        walker.update(
          1 / 120,
          { forward, right: 0, yaw, sprint: false, jump: false },
          collision,
          () => 0,
        );
      }
    };
    const depth = (): number =>
      (walker.feet.x - site.entrance[0]) * site.inward[0] +
      (walker.feet.z - site.entrance[1]) * site.inward[1];
    advance(4, 1);
    expect(depth()).toBeLessThan(-0.25); // Portal stays solid until published.
    for (let i = 0; i < 20; i++) stream.update(start);
    expect(stream.stats().resident).toBe(1);
    advance(5, 1);
    expect(depth()).toBeGreaterThan(6);
    expect(walker.feet.y).toBeCloseTo(site.floor, 1);
    expect(walker.grounded).toBe(true);
    advance(6, -1);
    expect(depth()).toBeLessThan(-1);
    expect(walker.feet.y).toBeLessThan(0.1);
    stream.dispose();
    materials.dispose?.();
  });
});
