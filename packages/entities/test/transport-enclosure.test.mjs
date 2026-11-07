import { readFile } from 'node:fs/promises';
import { DoubleSide, Raycaster, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const slugs = [
  'a220-300',
  'airbus-a320neo',
  'boeing-737-800',
  'citation-cj4',
  'dash-8-q400',
  'embraer-e175',
  'gulfstream-g650er',
];
const json = async (path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const opaqueHits = (scene, eye, direction) =>
  new Raycaster(eye, direction.clone().normalize())
    .intersectObject(scene, true)
    .filter((hit) => !hit.object.material.transparent);
/** Whether a ray leaves through glazing before any opaque surface (glass seen from either face). */
function throughGlass(scene, eye, direction) {
  const sides = new Map();
  scene.traverse((node) => {
    if (node.isMesh && node.material.transparent) {
      sides.set(node.material, node.material.side);
      node.material.side = DoubleSide;
    }
  });
  const first = new Raycaster(eye, direction.clone().normalize()).intersectObject(scene, true)[0];
  for (const [material, side] of sides) material.side = side;
  return !!first?.object.material.transparent;
}

describe.each(slugs)('%s flight-deck enclosure', (slug) => {
  let scene, eye, width;
  beforeAll(async () => {
    const source = await json(`source/aircraft/${slug}/source.json`);
    const types = await json(`source/aircraft/${slug}/entity.types.json`);
    const spec = types.types[source.id].components.aircraft.spec;
    eye = new Vector3(...spec.pilotEye);
    width = (await json(`source/aircraft/${slug}/models/airframe.json`)).width;
    const bytes = await readFile(
      new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), base),
    );
    ({ scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    ));
    scene.updateMatrixWorld(true);
  });

  it('encloses the lower sides and footwell before a ray reaches the outside paint', () => {
    for (const side of [-1, 1])
      for (const dz of [-0.3, 0, 0.4, 0.8]) {
        // The kit's own flight decks (737, A320) have deep side windows: a ray that leaves through
        // the glass is a view out, so that station is tested lower down, under the sill.
        const aim = [0.8, 1.2, 1.6]
          .map((drop) => new Vector3(side * width * 0.5, eye.y - drop, eye.z + dz).sub(eye))
          .find((ray) => !throughGlass(scene, eye, ray));
        expect(aim, `${side}/${dz} reaches a lower side under the windows`).toBeDefined();
        const hits = opaqueHits(scene, eye, aim);
        expect(hits.length, `${side}/${dz}`).toBeGreaterThan(0);
        expect(hits[0].distance).toBeLessThan(width + 0.5);
        expect(hits[0].object.material.name).not.toBe('airframe-paint');
      }
    const down = opaqueHits(scene, eye, new Vector3(0, -1, 0));
    expect(down.length).toBeGreaterThan(0);
    expect(down[0].distance).toBeLessThan(1.4);
    expect(down[0].object.material.name).not.toBe('airframe-paint');
  });

  it('retains a solid roof above the pilot and clear forward horizon', () => {
    const roof = opaqueHits(scene, eye, new Vector3(0, 1, 0));
    expect(roof.length).toBeGreaterThan(0);
    expect(roof[0].distance).toBeGreaterThan(0.08);
    expect(roof[0].distance).toBeLessThan(1);
    for (const dx of [-0.02, 0, 0.02])
      expect(opaqueHits(scene, eye, new Vector3(dx, 0, 1)), `horizon ${dx}`).toHaveLength(0);
  });

  it('uses outboard short sidesticks only on the Airbus decks', () => {
    if (!['a220-300', 'airbus-a320neo'].includes(slug)) return;
    for (const [index, side] of [
      [0, 1],
      [1, -1],
    ]) {
      // The shared deck names its sticks control-N; the A320's own deck A20N-side-stick-L/R.
      let control = scene.getObjectByName(`control-${index}`);
      scene.traverse((node) => {
        if (!control && new RegExp(`side-stick-${side > 0 ? 'L' : 'R'}$`).test(node.name))
          control = node;
      });
      expect(control).toBeDefined();
      const position = control.getWorldPosition(new Vector3());
      expect(position.x * side).toBeGreaterThan(Math.abs(eye.x) + 0.15);
    }
  });

  it('keeps the compact jet footwell and pedestal inside its curved belly', () => {
    if (slug !== 'citation-cj4') return;
    for (const z of [eye.z, eye.z + 0.5, eye.z + 1])
      for (const x of [0, eye.x, eye.x + 0.2]) {
        // The first surface from below is the kit's outer skin (paint or belly), not the cabin.
        const hit = opaqueHits(scene, new Vector3(x, 0, z), new Vector3(0, 1, 0))[0];
        expect(hit?.object.name, `${x}/${z}`).toMatch(/^fuselage-(skin|belly)$/);
      }
  });
});
