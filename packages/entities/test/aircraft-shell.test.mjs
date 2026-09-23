import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';

async function load(kind, version) {
  const sourceDirectory = kind === 'p51d' ? 'p-51' : 'hughes-500md';
  const path =
    version === 'source'
      ? `../source/aircraft/${sourceDirectory}/models/source.glb`
      : `../assets/molen/entities/aircraft/${kind}/model.glb`;
  const bytes = await readFile(new URL(path, import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}
function hit(scene, origin, direction) {
  const hits = new Raycaster(
    new Vector3(...origin),
    new Vector3(...direction).normalize(),
  ).intersectObject(scene, true);
  expect(hits.length, `No surface at ${origin}`).toBeGreaterThan(0);
  return hits[0];
}

describe.each(['source', 'imported'])('aircraft cabin enclosure (%s)', (version) => {
  it('hides the Mustang seat sides behind opaque bodywork below the canopy sill', async () => {
    const scene = await load('p51d', version);
    for (const side of [-1, 1])
      for (const y of [1.75, 1.88, 2.01])
        for (const z of [-0.8, -0.35, 0.3]) {
          const surface = hit(scene, [side * 3, y, z], [-side, 0, 0]);
          expect(surface.object.name).toBe('fuselage');
          expect(surface.object.material.transparent).toBe(false);
          expect(Math.abs(surface.point.x)).toBeGreaterThan(0.3);
          // The interior lining must not conceal inverted exterior winding.
          const normal = surface.face.normal.clone().transformDirection(surface.object.matrixWorld);
          expect(normal.x * side).toBeGreaterThan(0);
        }
  });
  it('encloses both Hughes door bottoms and the cabin roof with solid panels', async () => {
    const scene = await load('h500md', version);
    for (const side of [-1, 1])
      for (const y of [1.38, 1.42, 1.46])
        for (const z of [-0.1, 0.45, 0.85]) {
          const surface = hit(scene, [side * 3, y, z], [-side, 0, 0]);
          expect(surface.object.material.transparent).toBe(false);
          expect(Math.abs(surface.point.x)).toBeGreaterThan(0.7);
        }
    const cabin = scene.getObjectByName('cabin-panels');
    expect(cabin).toBeDefined();
    const roof = hit(cabin, [0.3, 3.5, 0.1], [0, -1, 0]);
    expect(roof.object.material.transparent).toBe(false);
    expect(roof.point.y).toBeGreaterThan(2.3);
    const normal = roof.face.normal.clone().transformDirection(roof.object.matrixWorld);
    expect(normal.y).toBeGreaterThan(0);
  });
  it.each([
    ['p51d', [0, 2.28, 0.05]],
    ['h500md', [-0.38, 1.7, 0.6]],
  ])('keeps forward visibility through the %s windscreen', async (kind, eye) => {
    const scene = await load(kind, version);
    // Look just beside the central windscreen divider.
    const surface = hit(scene, eye, [0.15, 0, 1]);
    expect(surface.object.material.transparent).toBe(true);
    expect(surface.object.material.opacity).toBeLessThan(0.3);
  });
});
