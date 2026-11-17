import { describe, expect, it } from 'vitest';
import {
  buildInteriorDoorFrame,
  buildInteriorDoorLeaf,
  INTERIOR_DOOR_OPEN_ANGLE,
  type InteriorDoor,
  interiorDoors,
} from '../../src/kernel/interior-doors';
import { createInteriorSite } from '../../src/kernel/interior-site';
import type { InteriorSite } from '../../src/kernel/interior-types';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { INTERIORS } from '../helpers/content';

function site(identity: string, label: string, width: number, ceiling = 3.5): InteriorSite {
  const outline: Vec2[] = [
    [0, 0],
    [width, 0],
    [width, 9],
    [0, 9],
  ];
  const result = createInteriorSite(
    { identity, labels: [label], outline },
    INTERIORS,
    outline,
    [],
    0,
    ceiling,
    FLAT_GROUND,
  );
  if (!result) throw new Error('No site');
  return result;
}

/** A leaf's `along` turned by `angle` right-handed about +Y, as a host swings it. */
function turned(door: InteriorDoor, leaf: number, angle: number): Vec2 {
  const [x, z] = door.leaves[leaf]?.along ?? [0, 0];
  return [x * Math.cos(angle) + z * Math.sin(angle), -x * Math.sin(angle) + z * Math.cos(angle)];
}

describe('interior doors', () => {
  it('hangs one painted leaf in a house doorway, under a fanlight, swinging into the hall', () => {
    const house = site('house-1', 'house', 9, 2.9);
    const [door, ...rest] = interiorDoors(house, INTERIORS);
    if (!door) throw new Error('No door');
    expect(rest).toHaveLength(0);
    const opening = house.openings[door.opening];
    expect(opening?.kind).toBe('door');
    expect(door).toMatchObject({ id: 'house-1#door0', look: 'panel' });
    expect(door.width).toBeCloseTo(1.1, 9);
    expect(door.leaves).toHaveLength(1);
    expect(door.inward[0]).toBeCloseTo(house.inward[0], 9);
    expect(door.inward[1]).toBeCloseTo(house.inward[1], 9);
    // A door's height, with the rest of the tall opening left to a fixed transom.
    expect(door.height).toBeCloseTo(2.099, 6);
    expect(door.top).toBeGreaterThan(door.center[1] + door.height + 0.3);
    const into = turned(door, 0, door.swing[0] ?? 0);
    expect(into[0] * door.inward[0] + into[1] * door.inward[1]).toBeGreaterThan(0.99);
    const out = turned(door, 0, -(door.swing[0] ?? 0));
    expect(out[0] * door.inward[0] + out[1] * door.inward[1]).toBeLessThan(-0.99);
    expect(Math.abs(door.swing[0] ?? 0)).toBe(INTERIOR_DOOR_OPEN_ANGLE);
  });

  it('gives a wide shop doorway a pair of glass leaves hung from either jamb', () => {
    const shop = site('shop-1', 'supermarket', 20);
    const [door] = interiorDoors(shop, INTERIORS);
    if (!door) throw new Error('No door');
    expect(door.look).toBe('glazed');
    expect(door.width).toBeCloseTo(2.2, 9);
    expect(door.leaves).toHaveLength(2);
    const [left, right] = door.leaves;
    expect((left?.width ?? 0) + (right?.width ?? 0)).toBeLessThan(door.width);
    expect(left?.along[0]).toBeCloseTo(-(right?.along[0] ?? 0), 9);
    for (const leaf of [0, 1]) {
      const into = turned(door, leaf, door.swing[leaf] ?? 0);
      expect(into[0] * door.inward[0] + into[1] * door.inward[1]).toBeGreaterThan(0.99);
    }
  });

  it('builds closed leaves inside the doorway, and nothing over a doorway they fill', () => {
    const shop = site('shop-2', 'supermarket', 20);
    const [door] = interiorDoors(shop, INTERIORS);
    if (!door) throw new Error('No door');
    const opening = shop.openings[door.opening];
    if (!opening) throw new Error('No opening');
    const out = new MeshBufferBuilder();
    for (const leaf of door.leaves.keys()) buildInteriorDoorLeaf(door, leaf, out);
    buildInteriorDoorFrame(door, out);
    const buffers = out.finalize();
    expect(buffers.groups).toHaveLength(1);
    for (let v = 0; v < buffers.vertexCount; v++) {
      const x = buffers.positions[v * 3] as number,
        y = buffers.positions[v * 3 + 1] as number,
        z = buffers.positions[v * 3 + 2] as number;
      const dx = x - door.center[0],
        dz = z - door.center[2];
      const along = dx * door.along[0] + dz * door.along[1];
      const depth = dx * door.inward[0] + dz * door.inward[1];
      expect(Math.abs(along)).toBeLessThanOrEqual(door.width / 2 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(door.center[1]);
      expect(y).toBeLessThanOrEqual(opening.top + 1e-6);
      // Pulls and knobs stand off the faces; the leaves sit just behind the wall.
      expect(depth).toBeGreaterThan(-0.12);
      expect(depth).toBeLessThan(0.2);
    }
    const low = site('low-1', 'house', 9, 2.38);
    const [short] = interiorDoors(low, INTERIORS);
    if (!short) throw new Error('No door');
    const frame = new MeshBufferBuilder();
    buildInteriorDoorFrame(short, frame);
    expect(frame.isEmpty()).toBe(true);
  });

  it('is decided by the site alone, and varies house to house', () => {
    const one = interiorDoors(site('house-7', 'house', 9), INTERIORS);
    expect(interiorDoors(site('house-7', 'house', 9), INTERIORS)).toEqual(one);
    const colors = new Set(
      Array.from(
        { length: 24 },
        (_, i) => interiorDoors(site(`house-${i}`, 'house', 9), INTERIORS)[0]?.color,
      ),
    );
    expect(colors.size).toBeGreaterThanOrEqual(5);
    const garage = { ...site('garage-1', 'supermarket', 20), parking: {} as never };
    expect(interiorDoors(garage, INTERIORS)).toEqual([]);
  });
});
