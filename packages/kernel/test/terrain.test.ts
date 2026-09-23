import type { Vec3 } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Character, installCharacterController, MoveIntent } from '../src/character';
import { Transform } from '../src/component';
import { installKinematics, KinematicBody } from '../src/kinematics';
import { installScripting } from '../src/scripting';
import { type GroundField, groundFieldOf, installTerrain, terrainScriptApi } from '../src/terrain';
import { World } from '../src/world';

/** A planar ramp: height = x / 4 (rises along +x). Normal is constant. */
function ramp(): GroundField {
  const n: Vec3 = [-0.25, 1, 0];
  const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
  const normal: Vec3 = [n[0] / len, n[1] / len, n[2] / len];
  return {
    sampleHeight: (x) => x / 4,
    normalAt: () => normal,
    cellSize: [2, 2],
  };
}

describe('kernel terrain service', () => {
  it('registers the ground field and answers height/normal/slope', () => {
    const w = new World();
    expect(groundFieldOf(w)).toBeUndefined();
    const handle = installTerrain(w, ramp());
    expect(groundFieldOf(w)).toBe(handle.field);
    expect(handle.heightAt(50, 25)).toBe(12.5);
    expect(handle.normalAt(0, 0)[1]).toBeCloseTo(0.97, 2);
    expect(handle.slopeAt(0, 0)).toBeCloseTo(0.03, 2);
  });

  it('casts rays: straight down, oblique, too short, and from below the surface', () => {
    const w = new World();
    const t = installTerrain(w, ramp());
    const down = t.raycast([50, 100, 25], [0, -1, 0], 500);
    expect(down).not.toBeNull();
    expect(down?.point[1]).toBeCloseTo(12.5, 3);
    expect(down?.distance).toBeCloseTo(87.5, 3);
    expect(down?.normal[1]).toBeGreaterThan(0);

    // Oblique ray from (0, 10, 0) heading +x and down: hits where 10 - s = (s)/4 => s = 8.
    const oblique = t.raycast([0, 10, 0], [1, -1, 0], 100);
    expect(oblique).not.toBeNull();
    expect(oblique?.point[0]).toBeCloseTo(8, 2);
    expect(oblique?.point[1]).toBeCloseTo(2, 2);

    expect(t.raycast([50, 100, 25], [0, -1, 0], 10)).toBeNull();
    const below = t.raycast([50, 0, 25], [0, -1, 0], 10);
    expect(below?.distance).toBe(0);
  });

  it('the character controller rests on the field and reports grounded', () => {
    const w = new World({ tickRate: 30 });
    installCharacterController(w); // installed BEFORE terrain: resolves the field lazily
    installTerrain(w, ramp());
    w.spawnRaw(
      {
        transform: { pos: [40, 50, 0], rot: [0, 0, 0, 1] },
        character: { speed: 0, jumpSpeed: 0, gravity: 30, vy: 0, grounded: false },
        moveIntent: { dir: [0, 0], jump: false },
      },
      'hero',
    );
    w.stepN(120);
    expect(w.get('hero', Transform)?.pos[1]).toBeCloseTo(10, 5);
    expect(w.get('hero', Character)?.grounded).toBe(true);
    expect(w.has('hero', MoveIntent)).toBe(true);
  });

  it('kinematic bodies with ground: terrain follow the surface while moving', () => {
    const w = new World({ tickRate: 10 });
    installKinematics(w, { ground: 'terrain' });
    installTerrain(w, ramp());
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
        kinematicBody: { vel: [4, -100, 0], slide: true },
      },
      'b',
    );
    w.stepN(10); // 4 m/s for 1 s -> x = 4, ground there is 1
    const pos = w.get('b', Transform)?.pos as Vec3;
    expect(pos[0]).toBeCloseTo(4, 5);
    expect(pos[1]).toBeCloseTo(1, 5);
    expect(w.get('b', KinematicBody)?.vel[1]).toBe(0); // landed: vertical velocity cleared
  });

  it('scripts reach the service through the terrain extension namespace', () => {
    const w = new World();
    const handle = installTerrain(w, ramp());
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(
      w,
      [
        {
          id: 's',
          source: `molen.on('tick', () => molen.set('c', 'counter', { n: molen.terrain.heightAt(50, 50) }));`,
        },
      ],
      { extensions: { terrain: terrainScriptApi(handle) } },
    );
    w.step();
    expect(w.get('c', { name: 'counter' })).toEqual({ n: 12.5 });
  });
});
