import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const eye = new Vector3(0, 3.04, 7.3);
function opaqueHits(scene, origin, direction) {
  return new Raycaster(origin, direction.clone().normalize())
    .intersectObject(scene, true)
    .filter(({ object }) => !object.material.transparent);
}
function belongsTo(object, name) {
  for (let node = object; node; node = node.parent) if (node.name === name) return true;
  return false;
}

describe.each(['source', 'imported'])('F-22 enclosure (%s)', (version) => {
  let scene;
  beforeAll(async () => {
    const path =
      version === 'source'
        ? 'source/aircraft/f-22a/models/source.glb'
        : 'assets/molen/entities/aircraft/f_22a/model.glb';
    const bytes = await readFile(new URL(`../../../content/entities/${path}`, import.meta.url));
    ({ scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    ));
    scene.updateMatrixWorld(true);
  });

  it('closes the canopy shoulder from both exterior sides with painted skin', () => {
    // Sample between the glazing/forebody section planes as well as at their joins.
    for (const side of [-1, 1])
      for (const [z, sill] of [
        [6.2, 2.763],
        [6.55, 2.74],
        [6.9, 2.713],
        [7.2, 2.69],
        [7.55, 2.66],
        [7.9, 2.63],
        [8.2, 2.602],
        [8.55, 2.57],
        [8.85, 2.54],
      ])
        for (const below of [0.04, 0.08, 0.16]) {
          const hits = opaqueHits(
            scene,
            new Vector3(side * 3, sill - below, z),
            new Vector3(-side, 0, 0),
          );
          expect(hits.length, `${side}/${z}/${below}`).toBeGreaterThan(0);
          expect(hits[0].object.material.name, `${side}/${z}/${below}`).toBe('F22-light-gray');
        }
  });

  it('closes the elevated intake shoulder without plugging the inlet', () => {
    for (const side of [-1, 1]) {
      for (const [x, y, z] of [
        [0.65, 2.38, 8],
        [0.8, 2.36, 7.15],
        [1.06, 2.38, 6.8],
        [1.5, 2.45, 6.12],
      ]) {
        const hits = opaqueHits(scene, new Vector3(side * 3, y, z), new Vector3(-side, 0, 0));
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].object.material.name).toBe('F22-light-gray');
        expect(Math.abs(hits[0].point.x)).toBeGreaterThan(x - 0.1);
      }
      const duct = opaqueHits(scene, new Vector3(side * 1.3, 1.7, 8), new Vector3(0, 0, -1));
      expect(duct[0].object.material.name).toBe('F22-duct');
    }
  });

  it('keeps the exterior skin behind an opaque inner tub beside and beneath the pilot', () => {
    for (const side of [-1, 1])
      for (const y of [1.9, 2.15, 2.4, 2.52])
        for (const z of [6.65, 7, 7.55, 7.9, 8.35]) {
          const direction = new Vector3(side * 0.55, y, z).sub(eye);
          const hits = opaqueHits(scene, eye, direction);
          expect(hits.length, `${side}/${y}/${z}`).toBeGreaterThan(0);
          expect(
            belongsTo(hits[0].object, 'cockpit'),
            `${side}/${y}/${z}: ${hits[0].object.name}`,
          ).toBe(true);
          expect(hits[0].distance).toBeLessThan(1.8);
        }
    for (const x of [-0.25, 0, 0.25])
      for (const z of [7.1, 7.7, 8.2]) {
        const hits = opaqueHits(scene, eye, new Vector3(x, 1.8, z).sub(eye));
        expect(
          belongsTo(hits[0].object, 'cockpit') || belongsTo(hits[0].object, 'flight-controls'),
        ).toBe(true);
      }
  });

  it('keeps the horizon visible through the HUD and canopy', () => {
    for (const x of [-0.06, 0, 0.06])
      expect(opaqueHits(scene, eye, new Vector3(x, 0, 1))).toHaveLength(0);
  });
});
