import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
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
        const aim = new Vector3(side * width * 0.5, eye.y - 0.8, eye.z + dz).sub(eye);
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
      const control = scene.getObjectByName(`control-${index}`);
      expect(control).toBeDefined();
      const position = control.getWorldPosition(new Vector3());
      expect(position.x * side).toBeGreaterThan(Math.abs(eye.x) + 0.15);
    }
  });

  it('keeps the compact jet footwell and pedestal inside its curved belly', () => {
    if (slug !== 'citation-cj4') return;
    for (const z of [eye.z, eye.z + 0.5, eye.z + 1])
      for (const x of [0, eye.x, eye.x + 0.2]) {
        const hit = opaqueHits(scene, new Vector3(x, 0, z), new Vector3(0, 1, 0))[0];
        expect(hit?.object.material.name, `${x}/${z}`).toBe('airframe-paint');
      }
  });
});
